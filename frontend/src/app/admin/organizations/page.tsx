import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, PageHeader, formatDate } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { adminSetMembershipRoleAction, reviewOrganizationAction } from '../actions';

export const metadata: Metadata = { title: 'Organisations · Admin' };

const TONE = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red' } as const;

type OrgRow = {
  id: string; name: string; org_type: 'school' | 'ngo'; city: string | null; contact_email: string | null; description: string | null;
  approval_status: keyof typeof TONE; review_note: string | null; created_at: string;
  memberships: { id: string; role: string; status: string; profile: { display_name: string } | null }[];
};

export default async function AdminOrganizationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, name, org_type, city, contact_email, description, approval_status, review_note, created_at, memberships:organization_memberships(id, role, status, profile:profiles(display_name))')
    .order('created_at', { ascending: false })
    .limit(200);
  const orgs = (data ?? []) as unknown as OrgRow[];
  const order = { pending: 0, approved: 1, suspended: 2, rejected: 3 };
  orgs.sort((a, b) => order[a.approval_status] - order[b.approval_status]);

  return (
    <div>
      <PageHeader title="Organisations" description="Approve schools and NGOs before their admins can invite members. Verify the request through an official channel first." />
      {orgs.length === 0 ? <EmptyState title="No organisations yet" /> : (
        <ul className="space-y-4">
          {orgs.map((o) => {
            const admins = o.memberships.filter((m) => m.role === 'organization_admin' && m.status === 'approved');
            const staff = o.memberships.filter((m) => m.status === 'approved' && m.role !== 'student');
            const studentCount = o.memberships.filter((m) => m.status === 'approved' && m.role === 'student').length;
            return (
              <li key={o.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">{o.name}</h2>
                    <p className="text-sm text-slate-600">
                      {o.org_type === 'ngo' ? 'NGO' : 'School'}{o.city ? ` · ${o.city}` : ''} · requested {formatDate(o.created_at)} · {studentCount} students
                    </p>
                    {o.contact_email ? <p className="text-sm text-slate-600">Contact: {o.contact_email}</p> : null}
                    {o.description ? <p className="mt-1 text-sm text-slate-800">{o.description}</p> : null}
                    <p className="mt-1 text-sm text-slate-600">Admins: {admins.map((a) => a.profile?.display_name ?? '—').join(', ') || '—'}</p>
                  </div>
                  <Badge tone={TONE[o.approval_status]}>{o.approval_status}</Badge>
                </div>
                <form action={reviewOrganizationAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orgId" value={o.id} />
                  <div className="min-w-[200px] flex-1">
                    <label htmlFor={`note-${o.id}`} className="label">Review note (optional)</label>
                    <input id={`note-${o.id}`} name="note" defaultValue={o.review_note ?? ''} className="input" maxLength={500} />
                  </div>
                  {o.approval_status !== 'approved' ? <SubmitButton name="decision" value="approved" className="btn-primary btn-sm" pendingText="…">Approve</SubmitButton> : null}
                  {o.approval_status === 'pending' ? <SubmitButton name="decision" value="rejected" className="btn-secondary btn-sm" pendingText="…">Reject</SubmitButton> : null}
                  {o.approval_status === 'approved' ? <SubmitButton name="decision" value="suspended" className="btn-danger btn-sm" pendingText="…" confirm="Suspend this organisation? Staff lose access to student data.">Suspend</SubmitButton> : null}
                </form>
                {o.approval_status === 'approved' && staff.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-brand-800">Manage staff roles</summary>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {staff.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <span>{m.profile?.display_name ?? '—'} · {m.role}</span>
                          <form action={adminSetMembershipRoleAction}>
                            <input type="hidden" name="membershipId" value={m.id} />
                            <input type="hidden" name="role" value={m.role === 'organization_admin' ? 'teacher' : 'organization_admin'} />
                            <SubmitButton className="btn-ghost btn-sm" pendingText="…">
                              {m.role === 'organization_admin' ? 'Make teacher' : 'Make organisation admin'}
                            </SubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <Link href={`/org/${o.id}`} className="link text-sm">Open organisation dashboard</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
