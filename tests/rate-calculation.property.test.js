/**
 * Feature: node-monitoring-system, Property 14: 速率计算
 * Validates: Requirements 6.7
 *
 * For any two adjacent time-series data points (cumulative values),
 * the network bandwidth rate should equal
 *   (current.network_sent - previous.network_sent) / (current.timestamp - previous.timestamp)
 * and disk IO rate likewise.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Extracted rate calculation logic from MonitorCard.
 * Given an array of time-series history points with cumulative values,
 * returns arrays of per-interval rates (bytes/s).
 */
function calculateRates(history) {
  const netSent = [];
  const netRecv = [];
  const ioRead = [];
  const ioWrite = [];

  for (let i = 1; i < history.length; i++) {
    const dt = (history[i].timestamp - history[i - 1].timestamp) || 1;
    netSent.push(Math.max(0, ((history[i].network_sent || 0) - (history[i - 1].network_sent || 0)) / dt));
    netRecv.push(Math.max(0, ((history[i].network_recv || 0) - (history[i - 1].network_recv || 0)) / dt));
    ioRead.push(Math.max(0, ((history[i].disk_io_read || 0) - (history[i - 1].disk_io_read || 0)) / dt));
    ioWrite.push(Math.max(0, ((history[i].disk_io_write || 0) - (history[i - 1].disk_io_write || 0)) / dt));
  }

  return { netSent, netRecv, ioRead, ioWrite };
}

/**
 * Arbitrary for a single time-series data point with cumulative byte values.
 */
const timeSeriesPointArb = fc.record({
  timestamp: fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
  network_sent: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  network_recv: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  disk_io_read: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  disk_io_write: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

/**
 * Arbitrary for a pair of adjacent points where the second timestamp >= first
 * and cumulative values are non-decreasing (normal operation, no counter reset).
 */
const adjacentIncreasingPairArb = fc.record({
  timestamp: fc.integer({ min: 1_000_000_000, max: 1_999_999_000 }),
  network_sent: fc.integer({ min: 0, max: 1_000_000_000_000 }),
  network_recv: fc.integer({ min: 0, max: 1_000_000_000_000 }),
  disk_io_read: fc.integer({ min: 0, max: 1_000_000_000_000 }),
  disk_io_write: fc.integer({ min: 0, max: 1_000_000_000_000 }),
}).chain((prev) =>
  fc.record({
    dt: fc.integer({ min: 1, max: 600 }),
    dNetSent: fc.integer({ min: 0, max: 1_000_000_000 }),
    dNetRecv: fc.integer({ min: 0, max: 1_000_000_000 }),
    dIoRead: fc.integer({ min: 0, max: 1_000_000_000 }),
    dIoWrite: fc.integer({ min: 0, max: 1_000_000_000 }),
  }).map((deltas) => ({
    prev,
    curr: {
      timestamp: prev.timestamp + deltas.dt,
      network_sent: prev.network_sent + deltas.dNetSent,
      network_recv: prev.network_recv + deltas.dNetRecv,
      disk_io_read: prev.disk_io_read + deltas.dIoRead,
      disk_io_write: prev.disk_io_write + deltas.dIoWrite,
    },
    deltas,
  }))
);

describe('Property 14: Rate Calculation', () => {
  it('rate equals (current - previous) / time_interval for non-decreasing cumulative values', () => {
    fc.assert(
      fc.property(adjacentIncreasingPairArb, ({ prev, curr, deltas }) => {
        const rates = calculateRates([prev, curr]);
        const dt = deltas.dt;

        expect(rates.netSent[0]).toBeCloseTo(deltas.dNetSent / dt, 5);
        expect(rates.netRecv[0]).toBeCloseTo(deltas.dNetRecv / dt, 5);
        expect(rates.ioRead[0]).toBeCloseTo(deltas.dIoRead / dt, 5);
        expect(rates.ioWrite[0]).toBeCloseTo(deltas.dIoWrite / dt, 5);
      }),
      { numRuns: 100 }
    );
  });

  it('rates are always non-negative (counter reset handled by clamping to 0)', () => {
    fc.assert(
      fc.property(
        timeSeriesPointArb,
        timeSeriesPointArb,
        (prev, curr) => {
          // Ensure curr timestamp >= prev timestamp for a valid pair
          if (curr.timestamp < prev.timestamp) {
            [prev, curr] = [curr, prev];
          }
          const rates = calculateRates([prev, curr]);

          expect(rates.netSent[0]).toBeGreaterThanOrEqual(0);
          expect(rates.netRecv[0]).toBeGreaterThanOrEqual(0);
          expect(rates.ioRead[0]).toBeGreaterThanOrEqual(0);
          expect(rates.ioWrite[0]).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('same timestamp uses dt=1 fallback (avoids division by zero)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        (ts, prevSent, deltaSent) => {
          const prev = { timestamp: ts, network_sent: prevSent, network_recv: 0, disk_io_read: 0, disk_io_write: 0 };
          const curr = { timestamp: ts, network_sent: prevSent + deltaSent, network_recv: 0, disk_io_read: 0, disk_io_write: 0 };

          const rates = calculateRates([prev, curr]);

          // When dt=0, the code uses || 1, so rate = delta / 1 = delta
          expect(rates.netSent[0]).toBeCloseTo(deltaSent, 5);
          expect(Number.isFinite(rates.netSent[0])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('decreasing cumulative values (counter reset) produce rate of 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000, max: 1_999_999_000 }),
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (ts, dt, prevSent, decrease) => {
          const prev = { timestamp: ts, network_sent: prevSent + decrease, network_recv: 0, disk_io_read: 0, disk_io_write: 0 };
          const curr = { timestamp: ts + dt, network_sent: prevSent, network_recv: 0, disk_io_read: 0, disk_io_write: 0 };

          const rates = calculateRates([prev, curr]);

          // Decreasing value means negative diff, clamped to 0 by Math.max(0, ...)
          expect(rates.netSent[0]).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
