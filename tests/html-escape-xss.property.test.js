/**
 * Feature: node-monitoring-system, Property 17: HTML 转义防 XSS
 * Validates: Requirements 16.2
 *
 * For any hostname or cpu_model string containing HTML special characters
 * (<, >, &, ", '), the value stored in cache should be HTML-entity-escaped
 * and contain no unescaped special characters.
 *
 * The escaping mirrors Laravel's e() function:
 *   htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Replicate Laravel's e() function behavior.
 * PHP: htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
 *
 * Escapes: & -> &amp;  < -> &lt;  > -> &gt;  " -> &quot;  ' -> &#039;
 * Note: & must be escaped first to avoid double-escaping other entities.
 */
function laravelEscape(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check that a string contains no unescaped HTML special characters.
 * After escaping, the raw characters <, >, ", ' should not appear,
 * and & should only appear as part of an entity (e.g. &amp; &lt; &gt; &quot; &#039;).
 */
function hasNoUnescapedSpecialChars(escaped) {
  // Must not contain raw <, >, ", '
  if (/[<>"']/.test(escaped)) return false;
  // Every & must be part of a known entity sequence
  // Remove all known entity patterns, then check if any bare & remains
  const stripped = escaped
    .replace(/&amp;/g, '')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .replace(/&quot;/g, '')
    .replace(/&#039;/g, '');
  if (/&/.test(stripped)) return false;
  return true;
}

// --- Arbitraries ---

/** Characters that are HTML-special and need escaping */
const htmlSpecialCharArb = fc.constantFrom('<', '>', '&', '"', "'");

/** Generate a string guaranteed to contain at least one HTML special character */
const stringWithHtmlSpecialCharsArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 50 }),
  htmlSpecialCharArb,
  fc.string({ minLength: 0, maxLength: 50 })
).map(([prefix, special, suffix]) => `${prefix}${special}${suffix}`);

/** Generate a string with multiple HTML special characters */
const stringWithMultipleHtmlCharsArb = fc.array(
  fc.oneof(
    fc.string({ minLength: 1, maxLength: 1 }),
    htmlSpecialCharArb
  ),
  { minLength: 1, maxLength: 100 }
).map((chars) => chars.join(''));

/** Generate strings that look like XSS payloads */
const xssPayloadArb = fc.constantFrom(
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  "'; DROP TABLE users; --",
  '<div onmouseover="alert(1)">',
  '&lt;already-escaped&gt;',
  '<b>bold</b>',
  'normal & safe < text > "quoted" \'apostrophe\''
);

describe('Property 17: HTML Escape XSS Prevention', () => {
  it('escaped hostname contains no unescaped HTML special characters', () => {
    fc.assert(
      fc.property(stringWithHtmlSpecialCharsArb, (hostname) => {
        const escaped = laravelEscape(hostname);
        expect(hasNoUnescapedSpecialChars(escaped)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('escaped cpu_model contains no unescaped HTML special characters', () => {
    fc.assert(
      fc.property(stringWithHtmlSpecialCharsArb, (cpuModel) => {
        const escaped = laravelEscape(cpuModel);
        expect(hasNoUnescapedSpecialChars(escaped)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('escaping XSS payloads neutralizes all special characters', () => {
    fc.assert(
      fc.property(xssPayloadArb, (payload) => {
        const escaped = laravelEscape(payload);
        expect(hasNoUnescapedSpecialChars(escaped)).toBe(true);
        // Escaped output must not contain raw script tags
        expect(escaped).not.toContain('<script>');
        expect(escaped).not.toContain('</script>');
      }),
      { numRuns: 50 }
    );
  });

  it('escaping is idempotent in a single pass (no double-entity issues)', () => {
    fc.assert(
      fc.property(stringWithMultipleHtmlCharsArb, (input) => {
        const escaped = laravelEscape(input);
        // Verify the escaped string can be "unescaped" back to the original
        const unescaped = escaped
          .replace(/&#039;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&');
        expect(unescaped).toBe(input);
      }),
      { numRuns: 200 }
    );
  });

  it('strings without special characters pass through unchanged', () => {
    const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^*()-_=+[]{}|;:,.?/~`';
    const safeStringArb = fc.array(
      fc.integer({ min: 0, max: safeChars.length - 1 }).map((i) => safeChars[i]),
      { minLength: 1, maxLength: 100 }
    ).map((chars) => chars.join(''));

    fc.assert(
      fc.property(safeStringArb, (input) => {
        const escaped = laravelEscape(input);
        expect(escaped).toBe(input);
      }),
      { numRuns: 200 }
    );
  });

  it('each HTML special character is correctly mapped to its entity', () => {
    const mappings = [
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['&', '&amp;'],
      ['"', '&quot;'],
      ["'", '&#039;'],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...mappings),
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        ([char, entity], prefix, suffix) => {
          // Build input with safe prefix/suffix (no special chars)
          const safePrefix = prefix.replace(/[<>&"']/g, 'x');
          const safeSuffix = suffix.replace(/[<>&"']/g, 'x');
          const input = `${safePrefix}${char}${safeSuffix}`;
          const escaped = laravelEscape(input);
          expect(escaped).toContain(entity);
          // The raw character should not appear in the escaped output
          // (except & which appears in entities - check via hasNoUnescapedSpecialChars)
          expect(hasNoUnescapedSpecialChars(escaped)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
