import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, PageHeader, formatDate } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { setAccountStatusAction, setPlatformAdminAction } from '../actions';

export const metadata: Metadata = { title: 'Users · Admin' };

const PAGE = 25;

type UserRow = {
  user_id: string; email: string; display_name: string; account_status: 'active' | 'suspended'; is_platform_admin: boolean;
  membership_count: number; created_at: string; last_sign_in_at: string | null; total_count: number;
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const viewer = await requirePlatformAdmin();
  const { q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const search = q.slice(0, 100);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: search || null, p_limit: PAGE, p_offset: (pageNum - 1) * PAGE });
  const rows = (data ?? []) as UserRow[];
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader title="Users" description="Grant platform administrator access sparingly. Every change is written to the audit log." />
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search by name or email</label>
        <input id="q" name="q" defaultValue={search} placeholder="Search by name or email" className="input max-w-sm" />
        <button type="submit" className="btn-secondary">Search</button>
      </form>
      {error ? <Alert tone="error">Could not load users.</Alert> : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>User</th><th>Status</th><th>Orgs</th><th>Joined</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => {
              const self = u.user_id === viewer.id;
              return (
                <tr key={u.user_id}>
                  <td>
                    <span className="font-medium">{u.display_name || '—'}</span>{self ? <span className="text-xs text-slate-600"> (you)</span> : null}
                    <span className="block text-xs text-slate-600">{u.email}</span>
                  </td>
                  <td className="space-x-1">
                    <Badge tone={u.account_status === 'active' ? 'green' : 'red'}>{u.account_status}</Badge>
                    {u.is_platform_admin ? <Badge tone="blue">platform admin</Badge> : null}
                  </td>
                  <td className="tabular-nums">{u.membership_count}</td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>{formatDate(u.last_sign_in_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <form action={setPlatformAdminAction}>
                        <input type="hidden" name="userId" value={u.user_id} />
                        <input type="hidden" name="grant" value={u.is_platform_admin ? 'false' : 'true'} />
                        <SubmitButton
                          className="btn-ghost btn-sm"
                          pendingText="…"
                          confirm={u.is_platform_admin ? 'Remove platform admin access?' : 'Grant full platform admin access to this user?'}
                        >
                          {u.is_platform_admin ? 'Remove admin' : 'Make admin'}
                        </SubmitButton>
                      </form>
                      {!self ? (
                        <form action={setAccountStatusAction}>
                          <input type="hidden" name="userId" value={u.user_id} />
                          <input type="hidden" name="status" value={u.account_status === 'active' ? 'suspended' : 'active'} />
                          <SubmitButton className="btn-ghost btn-sm" pendingText="…" confirm={u.account_status === 'active' ? 'Suspend this account?' : undefined}>
                            {u.account_status === 'active' ? 'Suspend' : 'Reactivate'}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>{total} users · page {pageNum} of {pages}</span>
        <div className="flex gap-2">
          {pageNum > 1 ? <Link href={qs(pageNum - 1)} className="btn-secondary btn-sm">Previous</Link> : null}
          {pageNum < pages ? <Link href={qs(pageNum + 1)} className="btn-secondary btn-sm">Next</Link> : null}
        </div>
      </div>
    </div>
  );
}
