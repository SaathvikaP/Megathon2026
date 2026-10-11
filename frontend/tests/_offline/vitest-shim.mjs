// The small subset of the Vitest API used by tests/unit, implemented on node:test.
// Only for offline runs (npm run test:offline); `npm test` uses real Vitest.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

export { describe, it };
export const test = it;

function matchers(actual, negate) {
  const check = (pass, message) => {
    if (negate ? pass : !pass) assert.fail(negate ? `Expected not: ${message}` : message);
  };
  return {
    toBe: (expected) => check(Object.is(actual, expected), `${String(actual)} to be ${String(expected)}`),
    toEqual: (expected) => {
      let equal = true;
      try { assert.deepStrictEqual(actual, expected); } catch { equal = false; }
      check(equal, `${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    },
    toBeNull: () => check(actual === null, `${String(actual)} to be null`),
    toBeUndefined: () => check(actual === undefined, `${String(actual)} to be undefined`),
    toContain: (item) => check(actual?.includes?.(item), `${JSON.stringify(actual)?.slice(0, 200)} to contain ${JSON.stringify(item)}`),
    toMatch: (re) => check(typeof actual === 'string' && (re instanceof RegExp ? re.test(actual) : actual.includes(re)), `${String(actual).slice(0, 200)} to match ${re}`),
    toBeGreaterThan: (n) => check(actual > n, `${actual} > ${n}`),
    toBeLessThanOrEqual: (n) => check(actual <= n, `${actual} <= ${n}`),
  };
}

export function expect(actual) {
  return { ...matchers(actual, false), not: matchers(actual, true) };
}
