/**
 * Feature: node-monitoring-system, Property 11: 节点状态判定
 * Validates: Requirements 5.3, 5.4
 *
 * For any node, if cache has LOAD_STATUS and LAST_LOAD_AT is within
 * push_interval × 3 seconds, status should be 'online'; if LAST_LOAD_AT
 * exceeds push_interval × 3 seconds, status should be 'offline';
 * if cache has no LOAD_STATUS record, status should be 'unknown'.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Replicate the node status determination logic from MonitorController::nodes().
 *
 * PHP source (MonitorController.php):
 *   $status = 'unknown';
 *   if ($loadStatus !== null) {
 *       $status = ($lastLoadAt && ($now - $lastLoadAt) <= $threshold) ? 'online' : 'offline';
 *   }
 *
 * @param {object|null} loadStatus - Cached load status data (null = never reported)
 * @param {number|null} lastLoadAt - Timestamp of last load report (null = no record)
 * @param {number} now - Current timestamp
 * @param {number} pushInterval - Push interval in seconds (from admin settings)
 * @returns {string} 'online' | 'offline' | 'unknown'
 */
function determineNodeStatus(loadStatus, lastLoadAt, now, pushInterval) {
  const threshold = pushInterval * 3;

  if (loadStatus === null) {
    return 'unknown';
  }

  if (lastLoadAt && (now - lastLoadAt) <= threshold) {
    return 'online';
  }

  return 'offline';
}

// --- Arbitraries ---

/** Push interval: realistic range 10-300 seconds, default 60 */
const pushIntervalArb = fc.integer({ min: 10, max: 300 });

/** Current timestamp: realistic Unix timestamp range */
const nowArb = fc.integer({ min: 1_700_000_000, max: 1_800_000_000 });

/** Non-null load status data (simulates cached monitor data) */
const loadStatusArb = fc.record({
  cpu: fc.double({ min: 0, max: 100, noNaN: true }),
  mem: fc.record({
    total: fc.integer({ min: 0, max: 2_000_000_000_000 }),
    used: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  }),
  updated_at: fc.integer({ min: 1_700_000_000, max: 1_800_000_000 }),
});

describe('Property 11: Node Status Determination', () => {
  it('status is "unknown" when loadStatus is null (node never reported)', () => {
    fc.assert(
      fc.property(
        nowArb,
        pushIntervalArb,
        fc.option(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { nil: null }),
        (now, pushInterval, lastLoadAt) => {
          const status = determineNodeStatus(null, lastLoadAt, now, pushInterval);
          expect(status).toBe('unknown');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status is "online" when loadStatus exists and lastLoadAt is within threshold', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        (loadStatus, now, pushInterval) => {
          const threshold = pushInterval * 3;
          // Generate lastLoadAt within [now - threshold, now] so (now - lastLoadAt) <= threshold
          const lastLoadAt = now - Math.floor(Math.random() * (threshold + 1));

          const status = determineNodeStatus(loadStatus, lastLoadAt, now, pushInterval);
          expect(status).toBe('online');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status is "online" when loadStatus exists and lastLoadAt is exactly at threshold boundary', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        (loadStatus, now, pushInterval) => {
          const threshold = pushInterval * 3;
          // Exactly at boundary: now - lastLoadAt === threshold
          const lastLoadAt = now - threshold;

          const status = determineNodeStatus(loadStatus, lastLoadAt, now, pushInterval);
          expect(status).toBe('online');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status is "offline" when loadStatus exists but lastLoadAt exceeds threshold', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        fc.integer({ min: 1, max: 1_000_000 }),
        (loadStatus, now, pushInterval, extraSeconds) => {
          const threshold = pushInterval * 3;
          // lastLoadAt is beyond threshold: (now - lastLoadAt) > threshold
          const lastLoadAt = now - threshold - extraSeconds;

          const status = determineNodeStatus(loadStatus, lastLoadAt, now, pushInterval);
          expect(status).toBe('offline');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status is "offline" when loadStatus exists but lastLoadAt is null/falsy', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        (loadStatus, now, pushInterval) => {
          // lastLoadAt is null (falsy) — PHP: $lastLoadAt && ... evaluates to false
          const status = determineNodeStatus(loadStatus, null, now, pushInterval);
          expect(status).toBe('offline');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status is "offline" when loadStatus exists but lastLoadAt is 0 (falsy)', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        (loadStatus, now, pushInterval) => {
          // lastLoadAt is 0 (falsy in PHP and JS)
          const status = determineNodeStatus(loadStatus, 0, now, pushInterval);
          expect(status).toBe('offline');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('threshold boundary: one second past threshold flips from online to offline', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        (loadStatus, now, pushInterval) => {
          const threshold = pushInterval * 3;

          // Exactly at threshold → online
          const atBoundary = determineNodeStatus(loadStatus, now - threshold, now, pushInterval);
          expect(atBoundary).toBe('online');

          // One second past threshold → offline
          const pastBoundary = determineNodeStatus(loadStatus, now - threshold - 1, now, pushInterval);
          expect(pastBoundary).toBe('offline');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status determination is consistent regardless of pushInterval value', () => {
    fc.assert(
      fc.property(
        loadStatusArb,
        nowArb,
        pushIntervalArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (loadStatus, now, pushInterval, fraction) => {
          const threshold = pushInterval * 3;

          // Generate lastLoadAt as a fraction of the threshold
          const withinThreshold = now - Math.floor(fraction * threshold);
          const beyondThreshold = now - threshold - 1 - Math.floor(fraction * 1000);

          const onlineStatus = determineNodeStatus(loadStatus, withinThreshold, now, pushInterval);
          const offlineStatus = determineNodeStatus(loadStatus, beyondThreshold, now, pushInterval);

          expect(onlineStatus).toBe('online');
          expect(offlineStatus).toBe('offline');
        }
      ),
      { numRuns: 100 }
    );
  });
});
