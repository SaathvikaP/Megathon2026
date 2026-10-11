import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured, getPublicSupabaseConfig } from '@/lib/env';

const PROTECTED_PREFIXES = ['/dashboard', '/learn', '/quest', '/profile', '/org', '/admin', '/activities'];

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/setup-required';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  const { url, anonKey } = getPublicSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Validates the JWT with Supabase Auth and refreshes it when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
