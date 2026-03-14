/**
 * Feature: node-monitoring-system, Property 15: 时序数据追加与保留
 * Validates: Requirements 8.1, 8.2
 *
 * For any set of data points appended to a time-series sorted set,
 * after cleanup (removing points older than 60 minutes), no remaining
 * point should have a timestamp older than 60 minutes from "now",
 * and all points within the 60-minute window must be preserved.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// --- Simulate Redis Sorted Set time-series operations in JS ---

/**
 * In-memory sorted set that mirrors Redis ZADD / ZRANGEBYSCORE / ZREMRANGEBYSCORE.
 * Members are stored as { score, member } pairs (score = timestamp).
 */
class SortedSet {
  constructor() {
    /** @type {Array<{ score: number, member: string }>} */
    this.entries = [];
  }

  /** ZADD — add a member with the given score (timestamp) */
  zadd(score, member) {
    this.entries.push({ score, member });
  }

  /** ZRANGEBYSCORE — return members whose score is in [min, max] */
  zrangebyscore(min, max) {
    return this.entries
      .filter((e) => e.score >= min && e.score <= max)
      .sort((a, b) => a.score - b.score)
      .map((e) => e.member);
  }

  /** ZREMRANGEBYSCORE — remove members whose score is in [min, max] */
  zremrangebyscore(min, max) {
    this.entries = this.entries.filter(
      (e) => !(e.score >= min && e.score <= max)
    );
  }
}

/**
 * Mirrors MonitorHistoryService::appendPoint()
 * Appends a data point with the given timestamp as score.
 */
function appendPoint(sortedSet, timestamp, data) {
  const point = { ...data, timestamp };
  sortedSet.zadd(timestamp, JSON.stringify(point));
}

/**
 * Mirrors MonitorHistoryService::getHistory()
 * Returns data points from the last `minutes` minutes relative to `now`.
 */
function getHistory(sortedSet, now, minutes = 60) {
  const from = now - minutes * 60;
  const results = sortedSet.zrangebyscore(from, now);
  return results.map((item) => JSON.parse(item));
}

/**
 * Mirrors MonitorHistoryService::cleanup()
 * Removes data points older than `minutes` minutes relative to `now`.
 */
function cleanup(sortedSet, now, minutes = 60) {
  const cutoff = now - minutes * 60;
  sortedSet.zremrangebyscore(-Infinity, cutoff);
}

// --- Arbitraries ---

const RETENTION_MINUTES = 60;
const RETENTION_SECONDS = RETENTION_MINUTES * 60; // 3600

/** Base "now" timestamp — a realistic Unix timestamp */
const BASE_NOW = 1710000000;

/** Generate a random data point payload */
const dataPointArb = fc.record({
  cpu: fc.double({ min: 0, max: 100, noNaN: true }),
  mem_used: fc.integer({ min: 0, max: 68_719_476_736 }),
  network_sent: fc.integer({ min: 0, max: 1_099_511_627_776 }),
  network_recv: fc.integer({ min: 0, max: 1_099_511_627_776 }),
  disk_io_read: fc.integer({ min: 0, max: 1_099_511_627_776 }),
  disk_io_write: fc.integer({ min: 0, max: 1_099_511_627_776 }),
});

/**
 * Generate a timestamp offset relative to "now".
 * Spans from 2 hours in the past to the present, so some points
 * will be within the 60-minute window and some will be outside.
 */
const timestampOffsetArb = fc.integer({ min: -7200, max: 0 });

/** Generate a list of (offset, data) pairs representing data points to append */
const dataPointsArb = fc.array(
  fc.tuple(timestampOffsetArb, dataPointArb),
  { minLength: 1, maxLength: 50 }
);

// --- Tests ---

describe('Property 15: Time-Series Data Append and Retention', () => {
  it('after cleanup, no data point has a timestamp older than 60 minutes from now', () => {
    fc.assert(
      fc.property(dataPointsArb, (points) => {
        const ss = new SortedSet();
        const now = BASE_NOW;

        // Append all data points
        for (const [offset, data] of points) {
          appendPoint(ss, now + offset, data);
        }

        // Run cleanup
        cleanup(ss, now, RETENTION_MINUTES);

        // Verify: no remaining point should be older than 60 minutes
        const cutoff = now - RETENTION_SECONDS;
        for (const entry of ss.entries) {
          expect(entry.score).toBeGreaterThan(cutoff);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('after cleanup, all points within the 60-minute window are preserved', () => {
    fc.assert(
      fc.property(dataPointsArb, (points) => {
        const ss = new SortedSet();
        const now = BASE_NOW;
        const cutoff = now - RETENTION_SECONDS;

        // Append all data points
        for (const [offset, data] of points) {
          appendPoint(ss, now + offset, data);
        }

        // Count how many points are strictly within the retention window
        const expectedCount = points.filter(
          ([offset]) => now + offset > cutoff
        ).length;

        // Run cleanup
        cleanup(ss, now, RETENTION_MINUTES);

        // All points within the window should still be present
        expect(ss.entries.length).toBe(expectedCount);
      }),
      { numRuns: 200 }
    );
  });

  it('getHistory returns only points within the requested time window', () => {
    fc.assert(
      fc.property(dataPointsArb, (points) => {
        const ss = new SortedSet();
        const now = BASE_NOW;
        const from = now - RETENTION_SECONDS;

        // Append all data points
        for (const [offset, data] of points) {
          appendPoint(ss, now + offset, data);
        }

        const history = getHistory(ss, now, RETENTION_MINUTES);

        // Every returned point must have a timestamp within [from, now]
        for (const point of history) {
          expect(point.timestamp).toBeGreaterThanOrEqual(from);
          expect(point.timestamp).toBeLessThanOrEqual(now);
        }

        // Count expected points in window
        const expectedInWindow = points.filter(
          ([offset]) => now + offset >= from && now + offset <= now
        ).length;
        expect(history.length).toBe(expectedInWindow);
      }),
      { numRuns: 200 }
    );
  });

  it('each appendPoint adds exactly one entry to the sorted set', () => {
    fc.assert(
      fc.property(dataPointsArb, (points) => {
        const ss = new SortedSet();
        const now = BASE_NOW;

        for (let i = 0; i < points.length; i++) {
          const [offset, data] = points[i];
          appendPoint(ss, now + offset, data);
          expect(ss.entries.length).toBe(i + 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('cleanup then getHistory yields consistent results (no stale data)', () => {
    fc.assert(
      fc.property(dataPointsArb, (points) => {
        const ss = new SortedSet();
        const now = BASE_NOW;

        // Append all data points
        for (const [offset, data] of points) {
          appendPoint(ss, now + offset, data);
        }

        // Cleanup first, then query
        cleanup(ss, now, RETENTION_MINUTES);
        const history = getHistory(ss, now, RETENTION_MINUTES);

        // After cleanup, getHistory should return exactly the remaining entries
        expect(history.length).toBe(ss.entries.length);

        // Every point in history must be within the retention window
        const cutoff = now - RETENTION_SECONDS;
        for (const point of history) {
          expect(point.timestamp).toBeGreaterThan(cutoff);
          expect(point.timestamp).toBeLessThanOrEqual(now);
        }
      }),
      { numRuns: 200 }
    );
  });
});
