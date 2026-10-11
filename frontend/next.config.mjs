import { fileURLToPath } from 'node:url';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
  } catch {
    return '';
  }
})();

const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts for hydration data.
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''}`,
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}`,
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The npm workspace root (one level up) holds node_modules and the lockfile.
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  experimental: {
    serverActions: {
      // Comic images are limited to 5 MB; allow some multipart overhead.
      bodySizeLimit: '6mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
