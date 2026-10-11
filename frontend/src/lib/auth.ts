import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Membership, Organization, Profile } from '@/lib/types';

export type ViewerMembership = Membership & { organization: Pick<Organization, 'id' | 'name' | 'org_type' | 'approval_status'> };

export type Viewer = {
  id: string;
  email: string | null;
  profile: Profile;
  isPlatformAdmin: boolean;
  memberships: ViewerMembership[];
};

/**
 * Loads the signed-in user, validated against Supabase Auth (getUser), plus
 * their profile and memberships. Role information here is for display and
 * routing only; every protected operation is re-checked by RLS / SQL functions.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: adminRow }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, student_identifier, grade_level, account_status, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('organization_memberships')
      .select('id, organization_id, user_id, role, status, created_at, organization:organizations(id, name, org_type, approval_status)')
      .eq('user_id', user.id)
      .order('created_at'),
  ]);

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    isPlatformAdmin: Boolean(adminRow) && profile.account_status === 'active',
    memberships: (memberships ?? []) as unknown as ViewerMembership[],
  };
});

export async function requireViewer(nextPath = '/dashboard'): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (viewer.profile.account_status !== 'active') redirect('/account-suspended');
  return viewer;
}

export async function requirePlatformAdmin(): Promise<Viewer> {
  const viewer = await requireViewer('/admin');
  if (!viewer.isPlatformAdmin) notFound();
  return viewer;
}

export function staffMemberships(viewer: Viewer) {
  return viewer.memberships.filter(
    (m) => m.status === 'approved' && m.organization?.approval_status === 'approved' && (m.role === 'teacher' || m.role === 'organization_admin'),
  );
}
