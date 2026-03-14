/**
 * Feature: node-monitoring-system, Property 3: 输入校验拒绝非法值
 * Validates: Requirements 1.4, 16.4
 *
 * For any hostname containing non-[a-zA-Z0-9\-_.] characters or exceeding 255 chars,
 * or cpu_model exceeding 255 chars, or ipv4/ipv6 not matching IP format,
 * or goroutines being negative, or cpu being negative or > 100,
 * UniProxyController::status() should reject the request with a validation error.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulate the Laravel validation logic from UniProxyController::status().
 * Returns { success: true } or { success: false, error }.
 */
function processStatusRequest(data) {
  // --- Required field validation ---
  if (data.cpu === undefined || data.cpu === null) return { success: false, error: 'cpu is required' };
  if (typeof data.cpu !== 'number' || Number.isNaN(data.cpu) || data.cpu < 0 || data.cpu > 100)
    return { success: false, error: 'cpu invalid' };

  for (const group of ['mem', 'swap', 'disk']) {
    if (!data[group] || typeof data[group] !== 'object') return { success: false, error: `${group} is required` };
    if (!Number.isInteger(data[group].total) || data[group].total < 0) return { success: false, error: `${group}.total invalid` };
    if (!Number.isInteger(data[group].used) || data[group].used < 0) return { success: false, error: `${group}.used invalid` };
  }

  // --- Optional fields validation ---
  if (data.network != null) {
    if (typeof data.network !== 'object') return { success: false, error: 'network invalid' };
    if (data.network.sent != null && (!Number.isInteger(data.network.sent) || data.network.sent < 0))
      return { success: false, error: 'network.sent invalid' };
    if (data.network.recv != null && (!Number.isInteger(data.network.recv) || data.network.recv < 0))
      return { success: false, error: 'network.recv invalid' };
  }

  if (data.disk_io != null) {
    if (typeof data.disk_io !== 'object') return { success: false, error: 'disk_io invalid' };
    if (data.disk_io.read != null && (!Number.isInteger(data.disk_io.read) || data.disk_io.read < 0))
      return { success: false, error: 'disk_io.read invalid' };
    if (data.disk_io.write != null && (!Number.isInteger(data.disk_io.write) || data.disk_io.write < 0))
      return { success: false, error: 'disk_io.write invalid' };
  }

  const hostnameRegex = /^[a-zA-Z0-9\-_.]+$/;
  if (data.hostname != null) {
    if (typeof data.hostname !== 'string' || data.hostname.length === 0 || data.hostname.length > 255 || !hostnameRegex.test(data.hostname))
      return { success: false, error: 'hostname invalid' };
  }

  if (data.uptime != null) {
    if (!Number.isInteger(data.uptime) || data.uptime < 0) return { success: false, error: 'uptime invalid' };
  }

  if (data.cpu_model != null) {
    if (typeof data.cpu_model !== 'string' || data.cpu_model.length > 255)
      return { success: false, error: 'cpu_model invalid' };
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (data.ipv4 != null) {
    if (typeof data.ipv4 !== 'string' || !ipv4Regex.test(data.ipv4)) return { success: false, error: 'ipv4 invalid' };
    const parts = data.ipv4.split('.').map(Number);
    if (parts.some((p) => p > 255)) return { success: false, error: 'ipv4 invalid' };
  }

  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  if (data.ipv6 != null) {
    if (typeof data.ipv6 !== 'string' || !ipv6Regex.test(data.ipv6)) return { success: false, error: 'ipv6 invalid' };
  }

  if (data.goroutines != null) {
    if (!Number.isInteger(data.goroutines) || data.goroutines < 0) return { success: false, error: 'goroutines invalid' };
  }

  return { success: true };
}

// --- Valid base request (required fields) for injecting invalid optional fields ---
const validBase = () => ({
  cpu: 50.0,
  mem: { total: 8589934592, used: 4294967296 },
  swap: { total: 2147483648, used: 536870912 },
  disk: { total: 107374182400, used: 53687091200 },
});

// --- Helper to build a string from a char set ---
const validHostChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
function buildString(charSet, len) {
  return fc.array(fc.integer({ min: 0, max: charSet.length - 1 }), { minLength: len, maxLength: len })
    .map((indices) => indices.map((i) => charSet[i]).join(''));
}

// --- Arbitraries for invalid values ---

/** Illegal characters for hostnames */
const invalidHostnameCharArb = fc.constantFrom(
  '<', '>', '&', ' ', '!', '@', '#', '$', '%', '^', '(', ')', '=', '+',
  '[', ']', '{', '}', '|', '\\', '/', '?', ',', ';', ':', '"', "'", '`', '~', '*'
);

/** Invalid hostname: contains at least one special/illegal character */
const invalidHostnameWithSpecialCharsArb = fc.tuple(
  buildString(validHostChars, 3),
  invalidHostnameCharArb,
  buildString(validHostChars, 3)
).map(([prefix, bad, suffix]) => `${prefix}${bad}${suffix}`);

/** Invalid hostname: exceeds 255 characters (all valid chars, just too long) */
const tooLongHostnameArb = fc.integer({ min: 256, max: 300 }).chain((len) =>
  buildString('abcdefghijklmnopqrstuvwxyz0123456789', len)
);

/** Invalid IPv4: octets out of range (256-999) */
const invalidIpv4OutOfRangeArb = fc.tuple(
  fc.integer({ min: 256, max: 999 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Invalid IPv4: wrong format (not 4 octets) */
const invalidIpv4WrongFormatArb = fc.constantFrom(
  '1.2.3', '1.2.3.4.5', 'abc.def.ghi.jkl', '192.168.1',
  '10.0.0', 'not-an-ip', '1234', ''
);

/** Negative goroutine counts */
const negativeGoroutinesArb = fc.integer({ min: -1_000_000, max: -1 });

/** Invalid CPU values: negative */
const negativeCpuArb = fc.double({ min: -1000, max: -0.001, noNaN: true });

/** Invalid CPU values: greater than 100 */
const overMaxCpuArb = fc.double({ min: 100.001, max: 10000, noNaN: true });

/** cpu_model exceeding 255 characters */
const tooLongCpuModelArb = fc.integer({ min: 256, max: 300 }).chain((len) =>
  buildString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ', len)
);

describe('Property 3: Input Validation Rejects Invalid Values', () => {
  it('rejects hostnames containing special/illegal characters', () => {
    fc.assert(
      fc.property(invalidHostnameWithSpecialCharsArb, (hostname) => {
        const data = { ...validBase(), hostname };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('hostname invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects hostnames exceeding 255 characters', () => {
    fc.assert(
      fc.property(tooLongHostnameArb, (hostname) => {
        const data = { ...validBase(), hostname };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('hostname invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects IPv4 addresses with out-of-range octets', () => {
    fc.assert(
      fc.property(invalidIpv4OutOfRangeArb, (ipv4) => {
        const data = { ...validBase(), ipv4 };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('ipv4 invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects IPv4 addresses with wrong format', () => {
    fc.assert(
      fc.property(invalidIpv4WrongFormatArb, (ipv4) => {
        const data = { ...validBase(), ipv4 };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('ipv4 invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects negative goroutine counts', () => {
    fc.assert(
      fc.property(negativeGoroutinesArb, (goroutines) => {
        const data = { ...validBase(), goroutines };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('goroutines invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects negative CPU values', () => {
    fc.assert(
      fc.property(negativeCpuArb, (cpu) => {
        const data = { ...validBase(), cpu };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('cpu invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects CPU values greater than 100', () => {
    fc.assert(
      fc.property(overMaxCpuArb, (cpu) => {
        const data = { ...validBase(), cpu };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('cpu invalid');
      }),
      { numRuns: 100 }
    );
  });

  it('rejects cpu_model exceeding 255 characters', () => {
    fc.assert(
      fc.property(tooLongCpuModelArb, (cpu_model) => {
        const data = { ...validBase(), cpu_model };
        const result = processStatusRequest(data);
        expect(result.success).toBe(false);
        expect(result.error).toBe('cpu_model invalid');
      }),
      { numRuns: 100 }
    );
  });
});
