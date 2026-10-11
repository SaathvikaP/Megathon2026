import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Questions · Admin' };

type Row = {
  id: string; slug: string; title: string; kind: 'core' | 'practice'; sort_order: number; is_published: boolean;
  parent_question_id: string | null; quiz: { level: number; title: string } | null; key: { question_id: string } | null;
  comics: { id: string; is_published: boolean }[];
};

export default async function AdminQuestionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('quiz_questions')
    .select('id, slug, title, kind, sort_order, is_published, parent_question_id, quiz:quizzes(level, title), key:quiz_answer_keys(question_id), comics:remediation_comics(id, is_published)')
    .order('sort_order');
  const rows = (data ?? []) as unknown as Row[];
  rows.sort((a, b) => (a.quiz?.level ?? 0) - (b.quiz?.level ?? 0) || (a.kind === b.kind ? 0 : a.kind === 'core' ? -1 : 1) || a.sort_order - b.sort_order);
  const levels = [...new Set(rows.map((r) => r.quiz?.level ?? 0))];

  return (
    <div>
      <PageHeader
        title="Quiz questions"
        description="Core questions are graded in Money Quest. Practice questions are ungraded variants shown after a mistake. Answer keys are visible only to platform admins."
        actions={<Link href="/admin/questions/new" className="btn-primary">New question</Link>}
      />
      <div className="space-y-8">
        {levels.map((lvl) => (
          <section key={lvl}>
            <h2 className="mb-2 text-lg font-bold">Level {lvl}{rows.find((r) => r.quiz?.level === lvl)?.quiz?.title ? ` — ${rows.find((r) => r.quiz?.level === lvl)!.quiz!.title}` : ''}</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Question</th><th>Kind</th><th>Status</th><th>Comic</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.filter((r) => (r.quiz?.level ?? 0) === lvl).map((r) => (
                    <tr key={r.id}>
                      <td><span className="font-medium">{r.title}</span><span className="block font-mono text-xs text-slate-600">{r.slug}</span></td>
                      <td>{r.kind === 'core' ? <Badge tone="blue">Core</Badge> : <Badge>Practice</Badge>}</td>
                      <td className="space-x-1">
                        {r.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}
                        {!r.key ? <Badge tone="red">No answer key</Badge> : null}
                      </td>
                      <td>{r.kind === 'core' ? (r.comics.some((c) => c.is_published) ? <Badge tone="green">Published</Badge> : r.comics.length ? <Badge tone="amber">Not published</Badge> : <Badge tone="red">None</Badge>) : '—'}</td>
                      <td><Link href={`/admin/questions/${r.id}`} className="link">Edit</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
