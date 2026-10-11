import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import type { QuizAttempt } from '@/lib/types';
import { QuizPlayer, type PlayerQuestion } from './QuizPlayer';

export const metadata: Metadata = { title: 'Money Quest' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlayPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!UUID_RE.test(attemptId)) notFound();
  const viewer = await requireViewer(`/quest/play/${attemptId}`);
  const supabase = await createSupabaseServerClient();

  const { data: attemptRow } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, quiz_id, attempt_number, status, question_count, correct_count, incorrect_count, base_points, bonus_points, total_points, passed, started_at, completed_at')
    .eq('id', attemptId)
    .maybeSingle();
  // Teachers can read their students' attempts through RLS, but only the owner can play one.
  if (!attemptRow || attemptRow.user_id !== viewer.id) notFound();
  const attempt = attemptRow as QuizAttempt;

  const [{ data: quiz }, { data: questions }, { data: answers }] = await Promise.all([
    supabase.from('quizzes').select('id, title, level, pass_correct_threshold').eq('id', attempt.quiz_id).maybeSingle(),
    supabase
      .from('quiz_questions')
      .select('id, title, prompt, sort_order, options:quiz_options(id, option_key, option_text, sort_order)')
      .eq('quiz_id', attempt.quiz_id)
      .eq('kind', 'core')
      .eq('is_published', true)
      .order('sort_order'),
    supabase.from('quiz_attempt_answers').select('question_id, is_correct').eq('attempt_id', attempt.id),
  ]);
  if (!quiz) notFound();

  const playerQuestions: PlayerQuestion[] = (questions ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    prompt: q.prompt,
    options: [...(q.options ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ id, option_key, option_text }) => ({ id, option_key, option_text })),
  }));

  const answered = Object.fromEntries((answers ?? []).map((a) => [a.question_id, a.is_correct as boolean]));

  return (
    <div className="container-page">
      <PageHeader
        title={`Level ${quiz.level}: ${quiz.title}`}
        description={`Attempt ${attempt.attempt_number}. Get at least ${quiz.pass_correct_threshold} of ${attempt.question_count} right to pass.`}
        actions={<Link href="/quest" className="btn-secondary">Back to levels</Link>}
      />
      <QuizPlayer
        attemptId={attempt.id}
        questions={playerQuestions}
        initiallyAnswered={answered}
        completedAttempt={attempt.status === 'completed' ? attempt : null}
        passThreshold={quiz.pass_correct_threshold}
      />
    </div>
  );
}
