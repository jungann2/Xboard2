/**
 * Feature: node-monitoring-system, Property 16: CacheKey 模式匹配
 * Validates: Requirements 10.1
 *
 * For any cache key of the form SERVER_{TYPE}_MONITOR_HISTORY (where TYPE is
 * uppercase letters and underscores), CacheKey::get() should match
 * ALLOWED_PATTERNS without producing a warning.
 *
 * LOCAL_MONITOR_STATUS and LOCAL_MONITOR_HISTORY should be found in CORE_KEYS.
 *
 * Non-monitor keys should not accidentally match monitor patterns.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// --- Replicate CacheKey PHP logic in JS ---

const CORE_KEYS = [
  'EMAIL_VERIFY_CODE',
  'LAST_SEND_EMAIL_VERIFY_TIMESTAMP',
  'TEMP_TOKEN',
  'LAST_SEND_EMAIL_REMIND_TRAFFIC',
  'SCHEDULE_LAST_CHECK_AT',
  'REGISTER_IP_RATE_LIMIT',
  'LAST_SEND_LOGIN_WITH_MAIL_LINK_TIMESTAMP',
  'PASSWORD_ERROR_LIMIT',
  'USER_SESSIONS',
  'FORGET_REQUEST_LIMIT',
  'LOCAL_MONITOR_STATUS',
  'LOCAL_MONITOR_HISTORY',
];

const ALLOWED_PATTERNS = [
  'SERVER_*_ONLINE_USER',
  'MULTI_SERVER_*_ONLINE_USER',
  'SERVER_*_LAST_CHECK_AT',
  'SERVER_*_LAST_PUSH_AT',
  'SERVER_*_LOAD_STATUS',
  'SERVER_*_LAST_LOAD_AT',
  'SERVER_*_MONITOR_HISTORY',
];

/**
 * Check if a key matches any allowed pattern.
 * Mirrors CacheKey::matchesPattern() — wildcard * maps to [A-Z_]+
 */
function matchesPattern(key) {
  for (const pattern of ALLOWED_PATTERNS) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '[A-Z_]+') + '$'
    );
    if (regex.test(key)) return true;
  }
  return false;
}

/**
 * Simulate CacheKey::get() classification.
 * Returns 'core' | 'pattern' | 'unknown'
 */
function classifyKey(key) {
  if (CORE_KEYS.includes(key)) return 'core';
  if (matchesPattern(key)) return 'pattern';
  return 'unknown';
}

// --- Arbitraries ---

/** Known node types used in the system */
const knownNodeTypes = [
  'VLESS', 'VMESS', 'TROJAN', 'HYSTERIA', 'TUIC',
  'ANYTLS', 'SHADOWSOCKS',
];

/** Generate a random valid server type (uppercase letters/underscores) */
const serverTypeArb = fc.oneof(
  fc.constantFrom(...knownNodeTypes),
  fc.array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')
    ),
    { minLength: 1, maxLength: 20 }
  ).map((chars) => chars.join(''))
    .filter((s) => /^[A-Z_]+$/.test(s))
);


/** Generate keys that should NOT match any monitor pattern */
const nonMonitorKeyArb = fc.oneof(
  // Random lowercase strings
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.length > 0),
  // Keys with wrong prefix
  fc.constantFrom(
    'CLIENT_VLESS_MONITOR_HISTORY',
    'NODE_VMESS_MONITOR_HISTORY',
    'USER_TROJAN_MONITOR_HISTORY',
    'SERVER_vless_MONITOR_HISTORY', // lowercase type
    'MONITOR_HISTORY',
    'SERVER_MONITOR_HISTORY',       // missing type segment — but * matches [A-Z_]+ so this won't match
    'LOCAL_MONITOR_SOMETHING',
    'RANDOM_KEY_NAME',
  )
);

describe('Property 16: CacheKey Pattern Matching', () => {
  it('SERVER_{TYPE}_MONITOR_HISTORY matches ALLOWED_PATTERNS for any valid type', () => {
    fc.assert(
      fc.property(serverTypeArb, (type) => {
        const key = `SERVER_${type}_MONITOR_HISTORY`;
        const classification = classifyKey(key);
        expect(classification).toBe('pattern');
      }),
      { numRuns: 200 }
    );
  });

  it('LOCAL_MONITOR_STATUS is in CORE_KEYS', () => {
    const classification = classifyKey('LOCAL_MONITOR_STATUS');
    expect(classification).toBe('core');
  });

  it('LOCAL_MONITOR_HISTORY is in CORE_KEYS', () => {
    const classification = classifyKey('LOCAL_MONITOR_HISTORY');
    expect(classification).toBe('core');
  });

  it('non-monitor keys with wrong prefix do not match SERVER_*_MONITOR_HISTORY', () => {
    fc.assert(
      fc.property(nonMonitorKeyArb, (key) => {
        // These keys should not be classified as matching the monitor history pattern
        // They may match other patterns or core keys, but specifically should not
        // match SERVER_*_MONITOR_HISTORY unless they actually follow that format
        const matchesMonitorHistory = new RegExp(
          '^SERVER_[A-Z_]+_MONITOR_HISTORY$'
        ).test(key);
        expect(matchesMonitorHistory).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('all known node types produce valid MONITOR_HISTORY keys', () => {
    for (const type of knownNodeTypes) {
      const key = `SERVER_${type}_MONITOR_HISTORY`;
      expect(classifyKey(key)).toBe('pattern');
    }
  });

  it('SERVER_*_MONITOR_HISTORY pattern does not match keys with lowercase type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /[a-z]/.test(s)),
        (type) => {
          const key = `SERVER_${type}_MONITOR_HISTORY`;
          // The pattern [A-Z_]+ only matches uppercase, so lowercase should fail
          const matchesMonitorHistory = new RegExp(
            '^SERVER_[A-Z_]+_MONITOR_HISTORY$'
          ).test(key);
          expect(matchesMonitorHistory).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('LOCAL_MONITOR_* keys are not matched by ALLOWED_PATTERNS (must be in CORE_KEYS)', () => {
    const localKeys = ['LOCAL_MONITOR_STATUS', 'LOCAL_MONITOR_HISTORY'];
    for (const key of localKeys) {
      // Should NOT match any ALLOWED_PATTERNS (those are SERVER_* patterns)
      expect(matchesPattern(key)).toBe(false);
      // But should be found in CORE_KEYS
      expect(CORE_KEYS.includes(key)).toBe(true);
    }
  });
});
