import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { createComicAction } from '../actions';

export const metadata: Metadata = { title: 'New comic · Admin' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewComicPage({ searchParams }: { searchParams: Promise<{ question?: string }> }) {
  const { question } = await searchParams;
  if (!question || !UUID_RE.test(question)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase.from('quiz_questions').select('id, title, prompt').eq('id', question).maybeSingle();
  if (!q) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Create a comic" actions={<Link href="/admin/comics" className="btn-secondary">All comics</Link>} />
      <div className="card space-y-4">
        <p className="text-slate-800">A draft five-panel script will be generated from this question, its explanation and its misconception. You can edit everything before producing the artwork.</p>
        <blockquote className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{q.title}</strong><br />{q.prompt}</blockquote>
        <form action={createComicAction}>
          <input type="hidden" name="questionId" value={q.id} />
          <SubmitButton pendingText="Creating…">Create draft comic</SubmitButton>
        </form>
      </div>
    </div>
  );
}
