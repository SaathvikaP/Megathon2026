import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge, EmptyState, PageHeader, PillarIcon, ProgressBar, pillarStyle } from '@/components/ui';
import type { Lesson, LessonProgress, Pillar } from '@/lib/types';

export const metadata: Metadata = { title: 'Lessons' };

export default async function LearnPage() {
  const viewer = await requireViewer('/learn');
  const supabase = await createSupabaseServerClient();

  const [{ data: pillars }, { data: lessons }, { data: progress }] = await Promise.all([
    supabase.from('learning_pillars').select('id, slug, title, tagline, description, icon, sort_order').order('sort_order'),
    supabase
      .from('lessons')
      .select('id, pillar_id, slug, title, summary, difficulty, estimated_minutes, sort_order')
      .eq('is_published', true)
      .order('sort_order'),
    supabase.from('lesson_progress').select('lesson_id, status').eq('user_id', viewer.id),
  ]);

  const statusByLesson = new Map((progress ?? []).map((p: Pick<LessonProgress, 'lesson_id' | 'status'>) => [p.lesson_id, p.status]));
  const allLessons = (lessons ?? []) as Pick<Lesson, 'id' | 'pillar_id' | 'slug' | 'title' | 'summary' | 'difficulty' | 'estimated_minutes'>[];

  if (!pillars?.length || allLessons.length === 0) {
    return (
      <div className="container-page">
        <PageHeader title="Lessons" />
        <EmptyState title="No lessons are published yet">Check back soon, or ask your platform administrator to publish lessons.</EmptyState>
      </div>
    );
  }

  return (
    <div className="container-page">
      <PageHeader title="Lessons" description="Short, practical lessons in four pillars. Each one takes 5–10 minutes." />
      <div className="space-y-10">
        {(pillars as Pillar[]).map((pillar) => {
          const items = allLessons.filter((l) => l.pillar_id === pillar.id);
          if (items.length === 0) return null;
          const done = items.filter((l) => statusByLesson.get(l.id) === 'completed').length;
          const s = pillarStyle(pillar.slug);
          return (
            <section key={pillar.id} aria-labelledby={`pillar-${pillar.slug}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${s.bg} ${s.text}`}><PillarIcon icon={pillar.icon} /></span>
                  <div>
                    <h2 id={`pillar-${pillar.slug}`} className="text-xl font-bold text-slate-900">{pillar.title}</h2>
                    <p className="text-sm text-slate-700">{pillar.tagline}</p>
                  </div>
                </div>
                <div className="w-full sm:w-56">
                  <p className="mb-1 text-right text-xs text-slate-600">{done} of {items.length} completed</p>
                  <ProgressBar value={done} max={items.length} label={`${pillar.title} progress`} />
                </div>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => {
                  const status = statusByLesson.get(l.id);
                  return (
                    <li key={l.id}>
                      <Link href={`/learn/${l.slug}`} className="card block h-full transition hover:border-brand-300 hover:shadow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">{l.estimated_minutes} min · {l.difficulty}</span>
                          {status === 'completed' ? <Badge tone="green">Completed</Badge> : status === 'in_progress' ? <Badge tone="amber">In progress</Badge> : null}
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-900">{l.title}</h3>
                        <p className="mt-1 text-sm text-slate-700">{l.summary}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
