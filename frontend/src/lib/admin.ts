import 'server-only';
import { getViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * For admin server actions: returns a user-scoped client when the caller is an
 * active platform admin, otherwise null. RLS and the SQL functions re-check this.
 */
export async function adminSupabase() {
  const viewer = await getViewer();
  if (!viewer || !viewer.isPlatformAdmin) return null;
  return { supabase: await createSupabaseServerClient(), viewer };
}

export const NOT_ADMIN = { error: 'You do not have permission to do that.' } as const;

export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? 'form')] ??= i.message;
  return out;
}
