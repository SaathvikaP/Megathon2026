import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader, formatDate, formatDateTime } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { formatPoints } from '@/lib/quest/scoring';
import { CreateJoinCodeForm } from './OrgForms';
import { reviewMembershipAction, revokeJoinCodeAction, setMembershipRoleAction } from './actions';

export const metadata: Metadata = { title: 'Organisation' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_LABEL: Record<string, string> = { student: 'Student', teacher: 'Teacher', organization_admin: 'Organisation admin' };

type ProgressRow = {
  user_id: string;
  display_name: string;
  student_identifier: string | null;
  role: string;
  lessons_completed: number;
  levels_passed: number;
  total_points: number;
  attempts_completed: number;
  last_activity_at: string | null;
};

export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  if (!UUID_RE.test(orgId)) notFound();
  const viewer = await requireViewer(`/org/${orgId}`);

  const myMembership = viewer.memberships.find(
    (m) => m.organization_id === orgId && m.status === 'approved' && m.organization?.approval_status === 'approved',
  );
  const isOrgAdmin = myMembership?.role === 'organization_admin' || viewer.isPlatformAdmin;
  const isStaff = isOrgAdmin || myMembership?.role === 'teacher';
  if (!isStaff) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: org }, { data: progress, error: progressError }, { data: members }, { data: codes }, { data: audit }] = await Promise.all([
    supabase.from('organizations').select('id, name, org_type, city, approval_status').eq('id', orgId).maybeSingle(),
    supabase.rpc('get_org_progress', { p_org_id: orgId }),
    isOrgAdmin
      ? supabase
          .from('organization_memberships')
          .select('id, user_id, role, status, created_at, profile:profiles(display_name, student_identifier)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
    isOrgAdmin
      ? supabase
          .from('organization_join_codes')
          .select('id, code, role, requires_approval, max_uses, use_count, expires_at, revoked_at, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    isOrgAdmin
      ? supabase.from('audit_log').select('id, action, created_at, details').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: null }),
  ]);
  if (!org) notFound();

  const rows = (progress ?? []) as ProgressRow[];
  const students = rows.filter((r) => r.role === 'student');
  const memberList = (members ?? []) as unknown as {
    id: string; user_id: string; role: string; status: string; created_at: string;
    profile: { display_name: string; student_identifier: string | null } | null;
  }[];
  const pending = memberList.filter((m) => m.status === 'pending');
  const now = Date.now();

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title={org.name}
        description={`${org.org_type === 'ngo' ? 'NGO' : 'School'}${org.city ? ` · ${org.city}` : ''} · You are ${isOrgAdmin ? 'an organisation admin' : 'a teacher'}`}
      />

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="mb-3 text-lg font-bold">Student progress</h2>
        {progressError ? <Alert tone="error">We could not load progress for this organisation.</Alert> : null}
        {students.length === 0 && !progressError ? (
          <EmptyState title="No students yet">{isOrgAdmin ? 'Create a student join code below and share it with your class.' : 'Ask your organisation admin to share a student join code.'}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>Lessons</th><th>Levels passed</th><th>Points</th><th>Attempts</th><th>Last active</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.user_id}>
                    <td><span className="font-medium">{s.display_name}</span>{s.student_identifier ? <span className="block text-xs text-slate-600">{s.student_identifier}</span> : null}</td>
                    <td className="tabular-nums">{s.lessons_completed}</td>
                    <td className="tabular-nums">{s.levels_passed}</td>
                    <td className="tabular-nums">{formatPoints(s.total_points)}</td>
                    <td className="tabular-nums">{s.attempts_completed}</td>
                    <td>{formatDate(s.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOrgAdmin ? (
        <>
          <section aria-labelledby="pending-heading">
            <h2 id="pending-heading" className="mb-3 text-lg font-bold">Pending requests ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-slate-700">No one is waiting for approval.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((m) => (
                  <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{m.profile?.display_name ?? 'New member'}</p>
                      <p className="text-sm text-slate-600">Wants to join as {ROLE_LABEL[m.role]} · {formatDate(m.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      {(['approved', 'rejected'] as const).map((d) => (
                        <form key={d} action={reviewMembershipAction}>
                          <input type="hidden" name="membershipId" value={m.id} />
                          <input type="hidden" name="orgId" value={orgId} />
                          <input type="hidden" name="decision" value={d} />
                          <SubmitButton className={d === 'approved' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} pendingText="…">
                            {d === 'approved' ? 'Approve' : 'Reject'}
                          </SubmitButton>
                        </form>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="members-heading">
            <h2 id="members-heading" className="mb-3 text-lg font-bold">Members</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {memberList.filter((m) => m.status !== 'pending').map((m) => {
                    const self = m.user_id === viewer.id;
                    const editable = !self && m.role !== 'organization_admin' && m.status === 'approved';
                    return (
                      <tr key={m.id}>
                        <td>{m.profile?.display_name ?? '—'}{self ? <span className="text-xs text-slate-600"> (you)</span> : null}</td>
                        <td>{ROLE_LABEL[m.role]}</td>
                        <td><Badge tone={m.status === 'approved' ? 'green' : 'red'}>{m.status}</Badge></td>
                        <td>
                          {editable ? (
                            <div className="flex flex-wrap gap-2">
                              <form action={setMembershipRoleAction}>
                                <input type="hidden" name="membershipId" value={m.id} />
                                <input type="hidden" name="orgId" value={orgId} />
                                <input type="hidden" name="role" value={m.role === 'student' ? 'teacher' : 'student'} />
                                <SubmitButton className="btn-ghost btn-sm" pendingText="…">Make {m.role === 'student' ? 'teacher' : 'student'}</SubmitButton>
                              </form>
                              <form action={reviewMembershipAction}>
                                <input type="hidden" name="membershipId" value={m.id} />
                                <input type="hidden" name="orgId" value={orgId} />
                                <input type="hidden" name="decision" value="revoked" />
                                <SubmitButton className="btn-ghost btn-sm" pendingText="…" confirm="Remove this member from the organisation?">Remove</SubmitButton>
                              </form>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="help mt-2">Only platform administrators can add or remove organisation admins.</p>
          </section>

          <section aria-labelledby="codes-heading" className="card">
            <h2 id="codes-heading" className="mb-3 text-lg font-bold">Join codes</h2>
            <CreateJoinCodeForm orgId={orgId} />
            {(codes ?? []).length > 0 ? (
              <div className="table-wrap mt-6">
                <table className="table">
                  <thead><tr><th>Code</th><th>Role</th><th>Uses</th><th>Expires</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(codes ?? []).map((c) => {
                      const expired = c.expires_at && new Date(c.expires_at).getTime() <= now;
                      const exhausted = c.max_uses != null && c.use_count >= c.max_uses;
                      const active = !c.revoked_at && !expired && !exhausted;
                      return (
                        <tr key={c.id}>
                          <td className="font-mono tracking-widest">{c.code}</td>
                          <td>{ROLE_LABEL[c.role]}{c.requires_approval ? <span className="block text-xs text-slate-600">needs approval</span> : null}</td>
                          <td className="tabular-nums">{c.use_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                          <td>{formatDate(c.expires_at)}</td>
                          <td>{active ? <Badge tone="green">Active</Badge> : <Badge>{c.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Used up'}</Badge>}</td>
                          <td>
                            {active ? (
                              <form action={revokeJoinCodeAction}>
                                <input type="hidden" name="codeId" value={c.id} />
                                <input type="hidden" name="orgId" value={orgId} />
                                <SubmitButton className="btn-ghost btn-sm" pendingText="…" confirm="Revoke this code? It will stop working immediately.">Revoke</SubmitButton>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="mb-3 text-lg font-bold">Recent activity log</h2>
            {(audit ?? []).length === 0 ? <p className="text-slate-700">No activity recorded yet.</p> : (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {(audit ?? []).map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 px-4 py-2 text-sm">
                    <span className="font-mono">{a.action}</span>
                    <span className="text-slate-600">{formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
