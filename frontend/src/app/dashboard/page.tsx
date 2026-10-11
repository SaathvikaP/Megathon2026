import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer, staffMemberships } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader, PillarIcon, ProgressBar, formatDate, pillarStyle } from '@/components/ui';
import { MAX_TOTAL_POINTS, formatPoints } from '@/lib/quest/scoring';
import type { Pillar, QuestOverviewRow } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const viewer = await requireViewer('/dashboard');
  const { password } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    { data: questProgress },
    { data: overview },
    { data: pillars },
    { data: lessons },
    { data: lessonProgress },
    { data: attempts },
    { data: mistakes },
  ] = await Promise.all([
    supabase.from('student_question_progress').select('best_points, first_attempt_correct').eq('user_id', viewer.id),
    supabase.rpc('get_money_quest_overview'),
    supabase.from('learning_pillars').select('id, slug, title, icon, sort_order').order('sort_order'),
    supabase.from('lessons').select('id, pillar_id, slug, title, sort_order').eq('is_published', true).order('sort_order'),
    supabase.from('lesson_progress').select('lesson_id, status, last_viewed_at').eq('user_id', viewer.id),
    supabase
      .from('quiz_attempts')
      .select('id, status, correct_count, question_count, total_points, passed, started_at, completed_at, quiz:quizzes(level, title)')
      .eq('user_id', viewer.id)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase.rpc('get_my_mistakes', { p_limit: 50 }),
  ]);

  const totalPoints = (questProgress ?? []).reduce((s, r) => s + (r.best_points ?? 0), 0);
  const levels = (overview ?? []) as QuestOverviewRow[];
  const passedLevels = levels.filter((l) => l.passed).length;
  const completedIds = new Set((lessonProgress ?? []).filter((p) => p.status === 'completed').map((p) => p.lesson_id));
  const startedIds = new Set((lessonProgress ?? []).map((p) => p.lesson_id));
  const allLessons = lessons ?? [];
  const nextLesson = allLessons.find((l) => startedIds.has(l.id) && !completedIds.has(l.id)) ?? allLessons.find((l) => !completedIds.has(l.id));
  const nextLevel = levels.find((l) => l.unlocked && !l.passed);
  const mistakeCount = (mistakes ?? []).length;
  const pendingMemberships = viewer.memberships.filter((m) => m.status === 'pending');
  const staff = staffMemberships(viewer);
  const firstName = viewer.profile.display_name?.split(' ')[0] || 'there';

  return (
    <div className="container-page space-y-8">
      <PageHeader title={`Hi ${firstName}!`} description="Here is where you are on your money-skills journey." />

      {password === 'updated' ? <Alert tone="success">Your password has been updated.</Alert> : null}
      {pendingMemberships.length > 0 ? (
        <Alert tone="info">
          Your request to join {pendingMemberships.map((m) => m.organization?.name).filter(Boolean).join(', ')} is waiting for approval.
        </Alert>
      ) : null}
      {staff.length > 0 ? (
        <Alert tone="info">
          You are {staff[0].role === 'organization_admin' ? 'an organisation admin' : 'a teacher'} at {staff[0].organization.name}.{' '}
          <Link href={`/org/${staff[0].organization_id}`} className="link">Open the organisation dashboard</Link>.
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
        <div className="card">
          <p className="text-sm text-slate-600">Money Quest points</p>
          <p className="text-3xl font-extrabold tabular-nums">{formatPoints(totalPoints)}</p>
          <p className="text-xs text-slate-600">of {formatPoints(MAX_TOTAL_POINTS)} possible</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Levels passed</p>
          <p className="text-3xl font-extrabold tabular-nums">{passedLevels} / {levels.length || 3}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Lessons completed</p>
          <p className="text-3xl font-extrabold tabular-nums">{completedIds.size} / {allLessons.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Mistakes to review</p>
          <p className="text-3xl font-extrabold tabular-nums">{mistakeCount}</p>
          {mistakeCount > 0 ? <Link href="/quest/mistakes" className="link text-sm">Review now</Link> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-bold">Up next</h2>
          <div className="mt-3 space-y-3">
            {nextLesson ? (
              <Link href={`/learn/${nextLesson.slug}`} className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300">
                <p className="text-xs uppercase tracking-wide text-slate-600">{startedIds.has(nextLesson.id) ? 'Continue lesson' : 'Next lesson'}</p>
                <p className="font-semibold">{nextLesson.title}</p>
              </Link>
            ) : allLessons.length > 0 ? (
              <p className="text-slate-700">You have completed every published lesson. 🎉</p>
            ) : null}
            {nextLevel ? (
              <Link href="/quest" className="block rounded-xl border border-slate-200 p-3 hover:border-brand-300">
                <p className="text-xs uppercase tracking-wide text-slate-600">{nextLevel.in_progress_attempt_id ? 'Continue' : 'Play'} Money Quest</p>
                <p className="font-semibold">Level {nextLevel.level}: {nextLevel.title}</p>
              </Link>
            ) : levels.length > 0 && passedLevels === levels.length ? (
              <p className="text-slate-700">You have passed every Money Quest level.</p>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold">Progress by pillar</h2>
          <ul className="mt-3 space-y-3">
            {((pillars ?? []) as Pick<Pillar, 'id' | 'slug' | 'title' | 'icon'>[]).map((p) => {
              const items = allLessons.filter((l) => l.pillar_id === p.id);
              const done = items.filter((l) => completedIds.has(l.id)).length;
              const s = pillarStyle(p.slug);
              return (
                <li key={p.id} className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${s.bg} ${s.text}`}><PillarIcon icon={p.icon} className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm"><span className="font-medium">{p.title}</span><span className="text-slate-600">{done}/{items.length}</span></div>
                    <ProgressBar value={done} max={items.length} label={`${p.title} lessons completed`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Recent Money Quest attempts</h2>
        {(attempts ?? []).length === 0 ? (
          <EmptyState title="No attempts yet" action={<Link href="/quest" className="btn-primary">Start Level 1</Link>}>
            Your results will appear here after you play.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Level</th><th>Started</th><th>Result</th><th>Points</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {((attempts ?? []) as unknown as { id: string; status: string; correct_count: number; question_count: number; total_points: number; passed: boolean; started_at: string; quiz: { level: number; title: string } | null }[]).map((a) => (
                  <tr key={a.id}>
                    <td>{a.quiz ? `Level ${a.quiz.level}: ${a.quiz.title}` : '—'}</td>
                    <td>{formatDate(a.started_at)}</td>
                    <td>
                      {a.status === 'in_progress' ? <Badge tone="amber">In progress</Badge> : (
                        <span className="flex items-center gap-2">{a.correct_count}/{a.question_count} {a.passed ? <Badge tone="green">Passed</Badge> : <Badge>Not passed</Badge>}</span>
                      )}
                    </td>
                    <td className="tabular-nums">{a.status === 'completed' ? formatPoints(a.total_points) : '—'}</td>
                    <td>{a.status === 'in_progress' ? <Link href={`/quest/play/${a.id}`} className="link">Continue</Link> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
