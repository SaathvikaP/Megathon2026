type RoleInfo = {
  isPlatformAdmin: boolean;
  accountStatus: string;
  memberships: { organization_id: string; role: string; status: string; organization?: { approval_status?: string } | null }[];
};

/**
 * Where a signed-in user lands: platform admins -> /admin, approved teachers and
 * organisation admins -> their organisation dashboard, everyone else -> /dashboard.
 * Routing only; every page re-checks access on the server and through RLS.
 */
export function homeRouteFor(user: RoleInfo): string {
  if (user.accountStatus !== 'active') return '/account-suspended';
  if (user.isPlatformAdmin) return '/admin';
  const staff = user.memberships.find(
    (m) => m.status === 'approved' && m.organization?.approval_status === 'approved' && (m.role === 'organization_admin' || m.role === 'teacher'),
  );
  if (staff) return `/org/${staff.organization_id}`;
  return '/dashboard';
}
