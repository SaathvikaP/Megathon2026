import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { toUserMessage } from '@/lib/errors';
import { FIRST_ATTEMPT_BONUS, MAX_TOTAL_POINTS, POINTS_PER_CORRECT, formatPoints } from '@/lib/quest/scoring';
import type { QuestOverviewRow } from '@/lib/types';
import { beginQuizAction } from './actions';

export const metadata: Metadata = { title: 'Money Quest' };

export default async function QuestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await requireViewer('/quest');
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: overview, error: overviewError }, { data: qp }] = await Promise.all([
    supabase.rpc('get_money_quest_overview'),
    supabase.from('student_question_progress').select('best_points').eq('user_id', viewer.id),
  ]);
  const levels = (overview ?? []) as QuestOverviewRow[];
  const totalPoints = (qp ?? []).reduce((sum, r) => sum + (r.best_points ?? 0), 0);

  return (
    <div className="container-page">
      <PageHeader
        title="Money Quest"
        description={`Answer five questions per level. ${POINTS_PER_CORRECT} points per correct answer, +${FIRST_ATTEMPT_BONUS} bonus the first time you get a question right. Get at least 4 of 5 right to unlock the next level.`}
        actions={<Link href="/quest/mistakes" className="btn-secondary">Review my mistakes</Link>}
      />

      {error ? <div className="mb-4"><Alert tone="error">{toUserMessage({ message: error })}</Alert></div> : null}
      {overviewError ? <div className="mb-4"><Alert tone="error">{toUserMessage(overviewError, 'We could not load Money Quest right now.')}</Alert></div> : null}

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">Your Money Quest points</p>
          <p className="text-3xl font-extrabold tabular-nums text-slate-900">
            {formatPoints(totalPoints)} <span className="text-base font-medium text-slate-600">/ {formatPoints(MAX_TOTAL_POINTS)}</span>
          </p>
        </div>
        <p className="max-w-md text-sm text-slate-700">Your total counts your best result on each question, so retrying a level can raise your score but never double-counts it.</p>
      </div>

      {levels.length === 0 && !overviewError ? (
        <EmptyState title="Money Quest is not available yet">No quiz levels have been published.</EmptyState>
      ) : (
        <ol className="grid gap-4 md:grid-cols-3">
          {levels.map((lvl) => (
            <li key={lvl.quiz_id} className={`card flex flex-col ${lvl.unlocked ? '' : 'opacity-80'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand-700">Level {lvl.level}</span>
                {lvl.passed ? <Badge tone="green">Passed</Badge> : lvl.unlocked ? <Badge tone="blue">Unlocked</Badge> : <Badge>Locked</Badge>}
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{lvl.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-700">{lvl.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-600">Questions</dt><dd className="font-semibold">{lvl.question_count}</dd></div>
                <div><dt className="text-slate-600">Attempts</dt><dd className="font-semibold">{lvl.attempts_completed}</dd></div>
                <div><dt className="text-slate-600">Best</dt><dd className="font-semibold">{lvl.attempts_completed ? `${lvl.best_correct}/${lvl.question_count} · ${formatPoints(lvl.best_points)} pts` : '—'}</dd></div>
                <div><dt className="text-slate-600">Latest</dt><dd className="font-semibold">{lvl.latest_correct != null ? `${lvl.latest_correct}/${lvl.question_count}` : '—'}</dd></div>
              </dl>
              <div className="mt-4">
                {!lvl.unlocked ? (
                  <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    Get at least {lvl.pass_correct_threshold} of 5 right in Level {lvl.level - 1} to unlock.
                  </p>
                ) : lvl.in_progress_attempt_id ? (
                  <Link href={`/quest/play/${lvl.in_progress_attempt_id}`} className="btn-primary w-full">Continue attempt</Link>
                ) : (
                  <form action={beginQuizAction}>
                    <input type="hidden" name="quizId" value={lvl.quiz_id} />
                    <SubmitButton className="btn-primary w-full" pendingText="Starting…">
                      {lvl.attempts_completed ? 'Try again' : 'Start level'}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
