import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl, safeNextPath } from '@/lib/urls';

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/quest')).toBe('/quest');
    expect(safeNextPath('/learn/money-in-money-out?x=1')).toBe('/learn/money-in-money-out?x=1');
  });

  it('rejects open-redirect tricks', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', 'javascript:alert(1)', '', 'quest']) {
      expect(safeNextPath(bad)).toBe('/dashboard');
    }
  });

  it('rejects non-strings and very long values', () => {
    expect(safeNextPath(undefined)).toBe('/dashboard');
    expect(safeNextPath(['/quest'])).toBe('/dashboard');
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBe('/dashboard');
    expect(safeNextPath(null, '/learn')).toBe('/learn');
  });
});

describe('isSafeExternalUrl', () => {
  it('accepts https links', () => {
    expect(isSafeExternalUrl('https://example.org/game')).toBe(true);
  });

  it('rejects other schemes, credentials and malformed values', () => {
    for (const bad of ['http://example.org', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.org', 'https://localhost', 'not a url', 42]) {
      expect(isSafeExternalUrl(bad)).toBe(false);
    }
  });
});
