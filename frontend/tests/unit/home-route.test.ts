import { describe, expect, it } from 'vitest';
import { homeRouteFor } from '@/lib/home-route';

const approvedOrg = { approval_status: 'approved' };

describe('homeRouteFor', () => {
  it('sends students to the student dashboard', () => {
    expect(homeRouteFor({ isPlatformAdmin: false, accountStatus: 'active', memberships: [] })).toBe('/dashboard');
    expect(
      homeRouteFor({
        isPlatformAdmin: false,
        accountStatus: 'active',
        memberships: [{ organization_id: 'org-1', role: 'student', status: 'approved', organization: approvedOrg }],
      }),
    ).toBe('/dashboard');
  });

  it('sends approved teachers and organisation admins to their organisation', () => {
    expect(
      homeRouteFor({
        isPlatformAdmin: false,
        accountStatus: 'active',
        memberships: [{ organization_id: 'org-7', role: 'teacher', status: 'approved', organization: approvedOrg }],
      }),
    ).toBe('/org/org-7');
    expect(
      homeRouteFor({
        isPlatformAdmin: false,
        accountStatus: 'active',
        memberships: [{ organization_id: 'org-9', role: 'organization_admin', status: 'approved', organization: approvedOrg }],
      }),
    ).toBe('/org/org-9');
  });

  it('ignores pending memberships and unapproved organisations', () => {
    expect(
      homeRouteFor({
        isPlatformAdmin: false,
        accountStatus: 'active',
        memberships: [
          { organization_id: 'a', role: 'teacher', status: 'pending', organization: approvedOrg },
          { organization_id: 'b', role: 'organization_admin', status: 'approved', organization: { approval_status: 'pending' } },
        ],
      }),
    ).toBe('/dashboard');
  });

  it('sends platform admins to the admin area', () => {
    expect(homeRouteFor({ isPlatformAdmin: true, accountStatus: 'active', memberships: [] })).toBe('/admin');
  });

  it('sends suspended accounts to the suspension notice, even admins', () => {
    expect(homeRouteFor({ isPlatformAdmin: true, accountStatus: 'suspended', memberships: [] })).toBe('/account-suspended');
  });
});
