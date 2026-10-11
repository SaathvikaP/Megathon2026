import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COMIC_BUCKET = 'comic-assets';

/**
 * Creates a short-lived signed URL using the caller's session. Storage RLS only
 * allows this for published comics (or for platform admins), so drafts stay private.
 */
export async function signComicAsset(supabase: SupabaseClient, path: string | null | undefined, expiresIn = 60 * 30) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(COMIC_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
