import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, PageHeader, formatDate } from '@/components/ui';
import { COMICSMAKER_URL } from '@/lib/comics/provider';

export const metadata: Metadata = { title: 'Comics · Admin' };

const REVIEW_TONE = { draft: 'gray', in_review: 'amber', approved: 'green', rejected: 'red' } as const;

type Row = {
  id: string; title: string; generation_status: string; review_status: keyof typeof REVIEW_TONE; is_published: boolean; asset_path: string | null; updated_at: string;
  question: { id: string; title: string; sort_order: number; quiz: { level: number } | null } | null;
};

export default async function AdminComicsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: core }] = await Promise.all([
    supabase
      .from('remediation_comics')
      .select('id, title, generation_status, review_status, is_published, asset_path, updated_at, question:quiz_questions(id, title, sort_order, quiz:quizzes(level))')
      .order('updated_at', { ascending: false }),
    supabase.from('quiz_questions').select('id, title').eq('kind', 'core'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  rows.sort((a, b) => (a.question?.quiz?.level ?? 99) - (b.question?.quiz?.level ?? 99) || (a.question?.sort_order ?? 0) - (b.question?.sort_order ?? 0));
  const covered = new Set(rows.map((r) => r.question?.id).filter(Boolean));
  const missing = (core ?? []).filter((q) => !covered.has(q.id));

  return (
    <div>
      <PageHeader
        title="Remediation comics"
        description={
          <>
            Comics are made manually on <a href={COMICSMAKER_URL} className="link" target="_blank" rel="noopener noreferrer">ComicsMaker.ai</a> (no public API was found), then uploaded here, reviewed and published. Students only ever see approved, published comics.
          </>
        }
      />
      {error ? <div className="mb-4"><Alert tone="error">That action could not be completed.</Alert></div> : null}
      {missing.length > 0 ? (
        <div className="mb-4"><Alert tone="warning">{missing.length} core question(s) have no comic yet: {missing.map((m) => m.title).join(', ')}. Open the question to create one.</Alert></div>
      ) : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Comic</th><th>Question</th><th>Production</th><th>Review</th><th>Published</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.title}</td>
                <td className="text-xs">{r.question ? `L${r.question.quiz?.level ?? '?'} · ${r.question.title}` : '—'}</td>
                <td className="text-xs">{r.generation_status.replace('_', ' ')}{r.asset_path ? <span className="block text-emerald-800">image uploaded</span> : null}</td>
                <td><Badge tone={REVIEW_TONE[r.review_status]}>{r.review_status.replace('_', ' ')}</Badge></td>
                <td>{r.is_published ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>}</td>
                <td className="whitespace-nowrap">{formatDate(r.updated_at)}</td>
                <td><Link href={`/admin/comics/${r.id}`} className="link">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
