export const EXPECTED_PROJECT_REF = 'umewelsxflzklynuibbh';

export class MissingConfigError extends Error {}

/**
 * Public Supabase configuration. The anon/publishable key is safe in the
 * browser only because every table is protected by Row Level Security.
 */
export function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || anonKey.startsWith('your-')) {
    throw new MissingConfigError(
      'Supabase is not configured. Copy frontend/.env.example to frontend/.env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new MissingConfigError('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  if (host !== `${EXPECTED_PROJECT_REF}.supabase.co` && process.env.ALLOW_NON_PROJECT_SUPABASE_URL !== 'true') {
    throw new MissingConfigError(
      `NEXT_PUBLIC_SUPABASE_URL must point to the shared project ${EXPECTED_PROJECT_REF}.supabase.co.`,
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  try {
    getPublicSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
