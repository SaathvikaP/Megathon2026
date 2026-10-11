import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import type { ExternalActivity } from '@/lib/types';
import { ActivityForm } from './ActivityForm';
import { deleteActivityAction } from './actions';

export const metadata: Metadata = { title: 'Activities · Admin' };

export default async function AdminActivitiesPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: pillars }] = await Promise.all([
    supabase.from('external_activities').select('id, title, description, url, provider_name, pillar_id, is_published, sort_order').order('sort_order'),
    supabase.from('learning_pillars').select('id, title').order('sort_order'),
  ]);
  const items = (data ?? []) as ExternalActivity[];

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="External activities"
        description="Links to third-party games or tools. Only add destinations you have checked yourself. Links open in a new tab; nothing is embedded and no student data is shared."
      />
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Add an activity</h2>
        <ActivityForm activity={null} pillars={pillars ?? []} />
      </section>
      {items.map((a) => (
        <details key={a.id} className="card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{a.title}</span>
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">{new URL(a.url).hostname}</span>
              {a.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Hidden</Badge>}
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <ActivityForm activity={a} pillars={pillars ?? []} />
            <form action={deleteActivityAction}>
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton className="btn-danger btn-sm" pendingText="…" confirm="Delete this activity?">Delete</SubmitButton>
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
