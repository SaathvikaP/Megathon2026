import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader } from '@/components/ui';
import { isSafeExternalUrl } from '@/lib/urls';
import type { ExternalActivity } from '@/lib/types';

export const metadata: Metadata = { title: 'Activities' };

export default async function ActivitiesPage() {
  await requireViewer('/activities');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('external_activities')
    .select('id, title, description, url, provider_name, pillar_id, is_published, sort_order, pillar:learning_pillars(title)')
    .eq('is_published', true)
    .order('sort_order');
  const items = ((data ?? []) as unknown as (ExternalActivity & { pillar: { title: string } | null })[]).filter((a) => isSafeExternalUrl(a.url));

  return (
    <div className="container-page">
      <PageHeader
        title="More activities"
        description="Games and tools from other providers, chosen by your platform team. They open in a new tab on another website."
      />
      {items.length === 0 ? (
        <EmptyState title="No activities yet">Your platform administrator has not added any external activities.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="card flex flex-col">
              {a.pillar ? <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{a.pillar.title}</p> : null}
              <h2 className="mt-1 text-lg font-bold">{a.title}</h2>
              {a.provider_name ? <p className="text-sm text-slate-600">by {a.provider_name}</p> : null}
              <p className="mt-2 flex-1 text-slate-700">{a.description}</p>
              <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary mt-4">
                Open activity <span className="sr-only">(opens an external website in a new tab)</span>
              </a>
              <p className="mt-2 text-xs text-slate-600">Leaving {'this site'}: {new URL(a.url).hostname}. Never share passwords, OTPs or bank details there.</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
