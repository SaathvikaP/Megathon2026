import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, formatDateTime } from '@/components/ui';

export const metadata: Metadata = { title: 'Audit log · Admin' };

export default async function AdminAuditPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('audit_log')
    .select('id, actor_id, action, entity_type, entity_id, organization_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const entries = (data ?? []) as {
    id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string;
  }[];
  const actorIds = [...new Set(entries.map((e) => e.actor_id).filter((v): v is string => Boolean(v)))];
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', actorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.display_name]));
  const rows = entries.map((e) => ({ ...e, actor: e.actor_id ? { display_name: names.get(e.actor_id) ?? 'Unknown user' } : null }));

  return (
    <div>
      <PageHeader title="Audit log" description="The 200 most recent administrative and content changes. Entries cannot be edited or deleted from the app." />
      {rows.length === 0 ? <EmptyState title="No entries yet" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td>{r.actor?.display_name ?? '—'}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td className="text-xs">{r.entity_type}{r.entity_id ? <span className="block font-mono text-slate-600">{r.entity_id}</span> : null}</td>
                  <td className="font-mono text-xs">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
