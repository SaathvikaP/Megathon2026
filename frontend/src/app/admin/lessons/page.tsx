import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Lessons · Admin' };

export default async function AdminLessonsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('lessons')
    .select('id, slug, title, is_published, sort_order, estimated_minutes, pillar:learning_pillars(title, sort_order)')
    .order('sort_order');
  const lessons = (data ?? []) as unknown as {
    id: string; slug: string; title: string; is_published: boolean; sort_order: number; estimated_minutes: number;
    pillar: { title: string; sort_order: number } | null;
  }[];
  lessons.sort((a, b) => (a.pillar?.sort_order ?? 0) - (b.pillar?.sort_order ?? 0) || a.sort_order - b.sort_order);

  return (
    <div>
      <PageHeader title="Lessons" actions={<Link href="/admin/lessons/new" className="btn-primary">New lesson</Link>} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Pillar</th><th>Order</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lessons.map((l) => (
              <tr key={l.id}>
                <td><span className="font-medium">{l.title}</span><span className="block font-mono text-xs text-slate-600">{l.slug}</span></td>
                <td>{l.pillar?.title ?? '—'}</td>
                <td className="tabular-nums">{l.sort_order}</td>
                <td>{l.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}</td>
                <td className="space-x-3 whitespace-nowrap">
                  <Link href={`/admin/lessons/${l.id}`} className="link">Edit</Link>
                  <Link href={`/learn/${l.slug}`} className="link">Preview</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
