import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, PageHeader } from '@/components/ui';
import { QuestionEditor, type EditableQuestion } from './QuestionEditor';

export const metadata: Metadata = { title: 'Edit question · Admin' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditQuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (id !== 'new' && !UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();

  const [{ data: quizzes }, { data: lessons }, { data: coreQuestions }] = await Promise.all([
    supabase.from('quizzes').select('id, level, title').order('level'),
    supabase.from('lessons').select('id, title').order('sort_order'),
    supabase.from('quiz_questions').select('id, title, quiz_id').eq('kind', 'core').order('sort_order'),
  ]);

  let question: EditableQuestion | null = null;
  let hasAnswers = false;
  let comicId: string | null = null;
  if (id !== 'new') {
    const [{ data: q }, { data: opts }, { data: key }, { count }, { data: comic }] = await Promise.all([
      supabase.from('quiz_questions').select('*').eq('id', id).maybeSingle(),
      supabase.from('quiz_options').select('id, option_key, option_text').eq('question_id', id),
      supabase.from('quiz_answer_keys').select('correct_option_id, explanation, teaching_point').eq('question_id', id).maybeSingle(),
      supabase.from('quiz_attempt_answers').select('id', { count: 'exact', head: true }).eq('question_id', id),
      supabase.from('remediation_comics').select('id').eq('question_id', id).limit(1).maybeSingle(),
    ]);
    if (!q) notFound();
    const options = Object.fromEntries((opts ?? []).map((o) => [o.option_key, o.option_text]));
    question = {
      ...q,
      options,
      correct: (opts ?? []).find((o) => o.id === key?.correct_option_id)?.option_key ?? null,
      explanation: key?.explanation ?? '',
      teaching_point: key?.teaching_point ?? '',
    } as EditableQuestion;
    hasAnswers = (count ?? 0) > 0;
    comicId = comic?.id ?? null;
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={id === 'new' ? 'New question' : 'Edit question'}
        actions={
          <>
            {question?.kind === 'core' ? (
              <Link href={comicId ? `/admin/comics/${comicId}` : `/admin/comics/new?question=${id}`} className="btn-secondary">
                {comicId ? 'Edit comic' : 'Create comic'}
              </Link>
            ) : null}
            <Link href="/admin/questions" className="btn-secondary">All questions</Link>
          </>
        }
      />
      {saved ? <div className="mb-4"><Alert tone="success">Question created.</Alert></div> : null}
      <div className="card">
        <QuestionEditor
          question={question}
          quizzes={quizzes ?? []}
          lessons={lessons ?? []}
          coreQuestions={coreQuestions ?? []}
          hasAnswers={hasAnswers}
        />
      </div>
    </div>
  );
}
