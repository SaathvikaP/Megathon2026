import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { homeRouteFor } from '@/lib/home-route';
import { safeNextPath } from '@/lib/urls';
import { LoginScreen } from './LoginScreen';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  link_invalid: 'That link is invalid or has expired. Please request a new one.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isSupabaseConfigured()) redirect('/setup-required');
  const params = await searchParams;
  // Empty when no explicit destination was requested; sign-in then routes by role.
  const next = safeNextPath(params.next, '');

  const viewer = await getViewer();
  if (viewer) {
    redirect(next || homeRouteFor({ isPlatformAdmin: viewer.isPlatformAdmin, accountStatus: viewer.profile.account_status, memberships: viewer.memberships }));
  }

  return <LoginScreen next={next} errorMessage={params.error ? ERRORS[params.error] ?? null : null} />;
}
