import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { Badge, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { JoinCodeForm, ProfileForm, RequestOrgForm } from './ProfileForms';
import { leaveOrganizationAction } from './actions';

export const metadata: Metadata = { title: 'Profile' };

const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', organization_admin: 'Organisation admin' } as const;
const STATUS_TONE = { approved: 'green', pending: 'amber', rejected: 'red', revoked: 'red' } as const;

export default async function ProfilePage() {
  const viewer = await requireViewer('/profile');

  return (
    <div className="container-page space-y-6">
      <PageHeader title="Your profile" description={viewer.email ? `Signed in as ${viewer.email}` : undefined} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-lg font-bold">Profile details</h2>
          <ProfileForm profile={viewer.profile} />
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-bold">Your organisations</h2>
          {viewer.memberships.length === 0 ? (
            <p className="text-slate-700">You are not part of a school or NGO yet. Learning works without one.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {viewer.memberships.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold">{m.organization?.name ?? 'Organisation'}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{ROLE_LABEL[m.role]}</Badge>
                      <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                      {m.organization && m.organization.approval_status !== 'approved' ? (
                        <Badge tone="amber">Organisation {m.organization.approval_status}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {m.status === 'approved' && m.organization?.approval_status === 'approved' && m.role !== 'student' ? (
                      <Link href={`/org/${m.organization_id}`} className="btn-secondary btn-sm">Manage</Link>
                    ) : null}
                    {m.role !== 'organization_admin' ? (
                      <form action={leaveOrganizationAction}>
                        <input type="hidden" name="orgId" value={m.organization_id} />
                        <SubmitButton className="btn-ghost btn-sm" pendingText="Leaving…" confirm="Leave this organisation? You will need a new join code to rejoin.">
                          Leave
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-2 font-semibold">Join with a code</h3>
            <JoinCodeForm />
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="text-lg font-bold">Register a school or NGO</h2>
        <p className="mb-4 mt-1 text-sm text-slate-700">
          Teachers and coordinators can request an organisation workspace. A platform administrator reviews each request; once approved you can create join codes and see your students&apos; progress.
        </p>
        <RequestOrgForm />
      </section>
    </div>
  );
}
