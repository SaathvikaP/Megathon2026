import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '@/lib/env';

/**
 * Supabase client bound to the signed-in user's session cookies.
 * All queries run as that user, so RLS policies apply. This app never uses
 * the service-role key.
 */
export async function createSupabaseServerClient() {
  // Read cookies before validating config so Next.js always treats callers as
  // per-request pages and never tries to prerender them at build time.
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // middleware refreshes the session instead.
        }
      },
    },
  });
}
