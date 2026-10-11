/** Only allow same-site relative redirects such as "/dashboard". Prevents open redirects. */
export function safeNextPath(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string') return fallback;
  if (next.length > 512 || !next.startsWith('/')) return fallback;
  // Browsers strip tabs/newlines and treat "\" as "/", so "/\t/evil.com" or "/\evil.com" can become protocol-relative.
  if (/[\u0000-\u001f\u007f\\]/.test(next) || next.startsWith('//')) return fallback;
  return next;
}

/** External activity links must be absolute https URLs without credentials. */
export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.');
  } catch {
    return false;
  }
}
