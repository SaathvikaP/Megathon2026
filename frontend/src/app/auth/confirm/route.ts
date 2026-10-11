import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/urls';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Handles email confirmation and password-recovery links (token_hash flow and PKCE code flow).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'));
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const supabase = await createSupabaseServerClient();
  let ok = false;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = '';
  if (ok) {
    target.pathname = type === 'recovery' ? '/reset-password' : next;
  } else {
    target.pathname = '/login';
    target.searchParams.set('error', 'link_invalid');
  }
  return NextResponse.redirect(target);
}
