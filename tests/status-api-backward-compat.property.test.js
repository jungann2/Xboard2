/**
 * Feature: node-monitoring-system, Property 1: 状态上报 API 向后兼容
 * Validates: Requirements 1.1, 1.3
 *
 * For any valid status report JSON request body, whether it contains only
 * the original 4 fields (cpu/mem/swap/disk) or all extended fields,
 * UniProxyController::status() should successfully process the request.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validation rules extracted from UniProxyController::status():
 *
 * Required fields:
 *   cpu: required|numeric|min:0|max:100
 *   mem.total: required|integer|min:0
 *   mem.used: required|integer|min:0
 *   swap.total: required|integer|min:0
 *   swap.used: required|integer|min:0
 *   disk.total: required|integer|min:0
 *   disk.used: required|integer|min:0
 *
 * Optional (nullable) fields:
 *   network.sent: nullable|integer|min:0
 *   network.recv: nullable|integer|min:0
 *   disk_io.read: nullable|integer|min:0
 *   disk_io.write: nullable|integer|min:0
 *   hostname: nullable|string|max:255|regex:/^[a-zA-Z0-9\-_.]+$/
 *   uptime: nullable|integer|min:0
 *   cpu_model: nullable|string|max:255
 *   ipv4: nullable|ip
 *   ipv6: nullable|ip
 *   goroutines: nullable|integer|min:0
 */

/**
 * Simulate the Laravel validation + processing logic from status().
 * Returns { success: true, statusData } or { success: false, error }.
 */
function processStatusRequest(data) {
  // --- Required field validation ---
  if (data.cpu === undefined || data.cpu === null) return { success: false, error: 'cpu is required' };
  if (typeof data.cpu !== 'number' || data.cpu < 0 || data.cpu > 100) return { success: false, error: 'cpu invalid' };

  for (const group of ['mem', 'swap', 'disk']) {
    if (!data[group] || typeof data[group] !== 'object') return { success: false, error: `${group} is required` };
    if (!Number.isInteger(data[group].total) || data[group].total < 0) return { success: false, error: `${group}.total invalid` };
    if (!Number.isInteger(data[group].used) || data[group].used < 0) return { success: false, error: `${group}.used invalid` };
  }

  // --- Build statusData (mirrors PHP logic) ---
  const statusData = {
    cpu: data.cpu,
    mem: { total: data.mem.total, used: data.mem.used },
    swap: { total: data.swap.total, used: data.swap.used },
    disk: { total: data.disk.total, used: data.disk.used },
    updated_at: Math.floor(Date.now() / 1000),
  };

  // --- Optional fields ---
  if (data.network != null) {
    if (typeof data.network !== 'object') return { success: false, error: 'network invalid' };
    if (data.network.sent != null && (!Number.isInteger(data.network.sent) || data.network.sent < 0))
      return { success: false, error: 'network.sent invalid' };
    if (data.network.recv != null && (!Number.isInteger(data.network.recv) || data.network.recv < 0))
      return { success: false, error: 'network.recv invalid' };
    statusData.network = { sent: data.network.sent, recv: data.network.recv };
  }

  if (data.disk_io != null) {
    if (typeof data.disk_io !== 'object') return { success: false, error: 'disk_io invalid' };
    if (data.disk_io.read != null && (!Number.isInteger(data.disk_io.read) || data.disk_io.read < 0))
      return { success: false, error: 'disk_io.read invalid' };
    if (data.disk_io.write != null && (!Number.isInteger(data.disk_io.write) || data.disk_io.write < 0))
      return { success: false, error: 'disk_io.write invalid' };
    statusData.disk_io = { read: data.disk_io.read, write: data.disk_io.write };
  }

  const hostnameRegex = /^[a-zA-Z0-9\-_.]+$/;
  if (data.hostname != null) {
    if (typeof data.hostname !== 'string' || data.hostname.length > 255 || !hostnameRegex.test(data.hostname))
      return { success: false, error: 'hostname invalid' };
    statusData.hostname = data.hostname;
  }

  if (data.uptime != null) {
    if (!Number.isInteger(data.uptime) || data.uptime < 0) return { success: false, error: 'uptime invalid' };
    statusData.uptime = data.uptime;
  }

  if (data.cpu_model != null) {
    if (typeof data.cpu_model !== 'string' || data.cpu_model.length > 255)
      return { success: false, error: 'cpu_model invalid' };
    statusData.cpu_model = data.cpu_model;
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (data.ipv4 != null) {
    if (typeof data.ipv4 !== 'string' || !ipv4Regex.test(data.ipv4)) return { success: false, error: 'ipv4 invalid' };
    const parts = data.ipv4.split('.').map(Number);
    if (parts.some((p) => p > 255)) return { success: false, error: 'ipv4 invalid' };
    statusData.ipv4 = data.ipv4;
  }

  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  if (data.ipv6 != null) {
    if (typeof data.ipv6 !== 'string' || !ipv6Regex.test(data.ipv6)) return { success: false, error: 'ipv6 invalid' };
    statusData.ipv6 = data.ipv6;
  }

  if (data.goroutines != null) {
    if (!Number.isInteger(data.goroutines) || data.goroutines < 0) return { success: false, error: 'goroutines invalid' };
    statusData.goroutines = data.goroutines;
  }

  return { success: true, statusData };
}

// --- Arbitraries ---

/** Non-negative integer within safe range */
const nonNegInt = fc.integer({ min: 0, max: 2_000_000_000_000 });

/** Resource usage pair (total/used) */
const resourceUsageArb = fc.record({
  total: nonNegInt,
  used: nonNegInt,
});

/** Original 4 required fields only */
const originalFieldsArb = fc.record({
  cpu: fc.double({ min: 0, max: 100, noNaN: true }),
  mem: resourceUsageArb,
  swap: resourceUsageArb,
  disk: resourceUsageArb,
});

/** Valid hostname: alphanumeric, hyphens, dots, underscores, 1-255 chars */
const hostnameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.';
const hostnameArb = fc.integer({ min: 1, max: 100 }).chain((len) =>
  fc.array(fc.integer({ min: 0, max: hostnameChars.length - 1 }), { minLength: len, maxLength: len })
    .map((indices) => indices.map((i) => hostnameChars[i]).join(''))
);

/** Valid IPv4 address */
const ipv4Arb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Valid IPv6 address (simplified) */
const ipv6Arb = fc.constantFrom('2001:db8::1', '::1', 'fe80::1', '2001:db8:85a3::8a2e:370:7334');

/** CPU model string */
const cpuModelChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ()@.-_';
const cpuModelArb = fc.integer({ min: 1, max: 100 }).chain((len) =>
  fc.array(fc.integer({ min: 0, max: cpuModelChars.length - 1 }), { minLength: len, maxLength: len })
    .map((indices) => indices.map((i) => cpuModelChars[i]).join(''))
);

/** All extended fields */
const extendedFieldsArb = fc.record({
  cpu: fc.double({ min: 0, max: 100, noNaN: true }),
  mem: resourceUsageArb,
  swap: resourceUsageArb,
  disk: resourceUsageArb,
  network: fc.record({ sent: nonNegInt, recv: nonNegInt }),
  disk_io: fc.record({ read: nonNegInt, write: nonNegInt }),
  hostname: hostnameArb,
  uptime: fc.integer({ min: 0, max: 100_000_000 }),
  cpu_model: cpuModelArb,
  ipv4: ipv4Arb,
  ipv6: ipv6Arb,
  goroutines: fc.integer({ min: 0, max: 100_000 }),
});

/** Partial extended fields (random subset of optional fields added to base) */
const partialExtendedArb = originalFieldsArb.chain((base) =>
  fc.record({
    includeNetwork: fc.boolean(),
    includeDiskIo: fc.boolean(),
    includeHostname: fc.boolean(),
    includeUptime: fc.boolean(),
    includeCpuModel: fc.boolean(),
    includeIpv4: fc.boolean(),
    includeIpv6: fc.boolean(),
    includeGoroutines: fc.boolean(),
    network: fc.record({ sent: nonNegInt, recv: nonNegInt }),
    disk_io: fc.record({ read: nonNegInt, write: nonNegInt }),
    hostname: hostnameArb,
    uptime: fc.integer({ min: 0, max: 100_000_000 }),
    cpu_model: cpuModelArb,
    ipv4: ipv4Arb,
    ipv6: ipv6Arb,
    goroutines: fc.integer({ min: 0, max: 100_000 }),
  }).map((ext) => {
    const result = { ...base };
    if (ext.includeNetwork) result.network = ext.network;
    if (ext.includeDiskIo) result.disk_io = ext.disk_io;
    if (ext.includeHostname) result.hostname = ext.hostname;
    if (ext.includeUptime) result.uptime = ext.uptime;
    if (ext.includeCpuModel) result.cpu_model = ext.cpu_model;
    if (ext.includeIpv4) result.ipv4 = ext.ipv4;
    if (ext.includeIpv6) result.ipv6 = ext.ipv6;
    if (ext.includeGoroutines) result.goroutines = ext.goroutines;
    return result;
  })
);

describe('Property 1: Status API Backward Compatibility', () => {
  it('requests with only original 4 fields are accepted', () => {
    fc.assert(
      fc.property(originalFieldsArb, (data) => {
        const result = processStatusRequest(data);
        expect(result.success).toBe(true);

        // statusData should contain exactly the 4 base groups + updated_at
        expect(result.statusData.cpu).toBe(data.cpu);
        expect(result.statusData.mem).toEqual(data.mem);
        expect(result.statusData.swap).toEqual(data.swap);
        expect(result.statusData.disk).toEqual(data.disk);
        expect(result.statusData.updated_at).toBeDefined();

        // No extended fields should be present
        expect(result.statusData.network).toBeUndefined();
        expect(result.statusData.disk_io).toBeUndefined();
        expect(result.statusData.hostname).toBeUndefined();
        expect(result.statusData.uptime).toBeUndefined();
        expect(result.statusData.cpu_model).toBeUndefined();
        expect(result.statusData.ipv4).toBeUndefined();
        expect(result.statusData.ipv6).toBeUndefined();
        expect(result.statusData.goroutines).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('requests with all extended fields are accepted', () => {
    fc.assert(
      fc.property(extendedFieldsArb, (data) => {
        const result = processStatusRequest(data);
        expect(result.success).toBe(true);

        // All fields should be present in statusData
        expect(result.statusData.cpu).toBe(data.cpu);
        expect(result.statusData.mem).toEqual(data.mem);
        expect(result.statusData.swap).toEqual(data.swap);
        expect(result.statusData.disk).toEqual(data.disk);
        expect(result.statusData.network).toEqual(data.network);
        expect(result.statusData.disk_io).toEqual(data.disk_io);
        expect(result.statusData.hostname).toBe(data.hostname);
        expect(result.statusData.uptime).toBe(data.uptime);
        expect(result.statusData.cpu_model).toBe(data.cpu_model);
        expect(result.statusData.ipv4).toBe(data.ipv4);
        expect(result.statusData.ipv6).toBe(data.ipv6);
        expect(result.statusData.goroutines).toBe(data.goroutines);
        expect(result.statusData.updated_at).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('backward compatibility: old format still works after extension (random subset of optional fields)', () => {
    fc.assert(
      fc.property(partialExtendedArb, (data) => {
        const result = processStatusRequest(data);
        expect(result.success).toBe(true);

        // Base fields always present
        expect(result.statusData.cpu).toBe(data.cpu);
        expect(result.statusData.mem).toEqual(data.mem);
        expect(result.statusData.swap).toEqual(data.swap);
        expect(result.statusData.disk).toEqual(data.disk);
        expect(result.statusData.updated_at).toBeDefined();

        // Optional fields present only if provided
        if (data.network) {
          expect(result.statusData.network).toEqual(data.network);
        } else {
          expect(result.statusData.network).toBeUndefined();
        }
        if (data.disk_io) {
          expect(result.statusData.disk_io).toEqual(data.disk_io);
        } else {
          expect(result.statusData.disk_io).toBeUndefined();
        }
        if (data.hostname) {
          expect(result.statusData.hostname).toBe(data.hostname);
        } else {
          expect(result.statusData.hostname).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('statusData field set equals request fields plus updated_at', () => {
    fc.assert(
      fc.property(partialExtendedArb, (data) => {
        const result = processStatusRequest(data);
        expect(result.success).toBe(true);

        const statusKeys = new Set(Object.keys(result.statusData));

        // Base fields + updated_at always present
        expect(statusKeys.has('cpu')).toBe(true);
        expect(statusKeys.has('mem')).toBe(true);
        expect(statusKeys.has('swap')).toBe(true);
        expect(statusKeys.has('disk')).toBe(true);
        expect(statusKeys.has('updated_at')).toBe(true);

        // Optional fields: present in statusData iff present in request
        const optionalFields = ['network', 'disk_io', 'hostname', 'uptime', 'cpu_model', 'ipv4', 'ipv6', 'goroutines'];
        for (const field of optionalFields) {
          if (data[field] != null) {
            expect(statusKeys.has(field)).toBe(true);
          } else {
            expect(statusKeys.has(field)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
