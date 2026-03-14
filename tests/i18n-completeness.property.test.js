/**
 * Feature: node-monitoring-system, Property 23: i18n 翻译完整性
 * Validates: Requirements 14.3
 *
 * Verifies that the `monitor.*` namespace has matching entries
 * across all three language files (zh-CN, en-US, ko-KR).
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../public/assets/admin/locales');

/**
 * Parse a locale JS file and extract the translations object.
 * The files assign to window.XBOARD_TRANSLATIONS[locale].
 */
function loadLocale(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.js`);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Create a minimal sandbox with window object
  const window = { XBOARD_TRANSLATIONS: {} };
  const fn = new Function('window', content);
  fn(window);

  return window.XBOARD_TRANSLATIONS[locale];
}

/**
 * Recursively extract all leaf keys from a nested object.
 * Returns keys in dot notation, e.g. "status.online".
 */
function extractKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

// Load all three locale files
const zhCN = loadLocale('zh-CN');
const enUS = loadLocale('en-US');
const koKR = loadLocale('ko-KR');

// Extract monitor namespace keys
const zhMonitorKeys = extractKeys(zhCN.monitor);
const enMonitorKeys = extractKeys(enUS.monitor);
const koMonitorKeys = extractKeys(koKR.monitor);

const allLocales = [
  { name: 'zh-CN', keys: zhMonitorKeys },
  { name: 'en-US', keys: enMonitorKeys },
  { name: 'ko-KR', keys: koMonitorKeys },
];

describe('Property 23: i18n Translation Completeness', () => {
  it('all three locale files should have a monitor namespace', () => {
    expect(zhCN.monitor).toBeDefined();
    expect(enUS.monitor).toBeDefined();
    expect(koKR.monitor).toBeDefined();
  });

  it('monitor namespace should have the same keys across all locales', () => {
    expect(zhMonitorKeys).toEqual(enMonitorKeys);
    expect(zhMonitorKeys).toEqual(koMonitorKeys);
  });

  it('property: for any monitor key in any locale, all other locales contain that key', () => {
    // Collect the union of all keys across all locales
    const allKeys = [...new Set([...zhMonitorKeys, ...enMonitorKeys, ...koMonitorKeys])];

    // Use fast-check to pick arbitrary keys from the union and verify presence in all locales
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allKeys.length - 1 }),
        (index) => {
          const key = allKeys[index];
          for (const locale of allLocales) {
            if (!locale.keys.includes(key)) {
              throw new Error(
                `Key "monitor.${key}" is missing in ${locale.name}`
              );
            }
          }
        }
      ),
      { numRuns: Math.min(allKeys.length * 3, 100) }
    );
  });

  it('property: for any pair of locales, their monitor key sets are identical', () => {
    const localePairs = [
      ['zh-CN', 'en-US'],
      ['zh-CN', 'ko-KR'],
      ['en-US', 'ko-KR'],
    ];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: localePairs.length - 1 }),
        (pairIndex) => {
          const [nameA, nameB] = localePairs[pairIndex];
          const keysA = allLocales.find((l) => l.name === nameA).keys;
          const keysB = allLocales.find((l) => l.name === nameB).keys;

          const missingInB = keysA.filter((k) => !keysB.includes(k));
          const missingInA = keysB.filter((k) => !keysA.includes(k));

          if (missingInB.length > 0) {
            throw new Error(
              `Keys in ${nameA} missing from ${nameB}: ${missingInB.map((k) => `monitor.${k}`).join(', ')}`
            );
          }
          if (missingInA.length > 0) {
            throw new Error(
              `Keys in ${nameB} missing from ${nameA}: ${missingInA.map((k) => `monitor.${k}`).join(', ')}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
