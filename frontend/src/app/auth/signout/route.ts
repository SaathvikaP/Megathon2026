import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export async function POST(request: NextRequest) {
  // Same-origin check: the sign-out form only posts from this site.
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url, { status: 303 });
}
