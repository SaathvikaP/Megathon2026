import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LessonRenderer, SourceList } from '@/components/LessonRenderer';
import { Badge, PillarIcon, pillarStyle } from '@/components/ui';
import type { Lesson, Pillar } from '@/lib/types';
import { CompleteLessonForm, LessonTracker } from './LessonClient';

export const metadata: Metadata = { title: 'Lesson' };

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) notFound();
  const viewer = await requireViewer(`/learn/${slug}`);
  const supabase = await createSupabaseServerClient();

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, pillar_id, slug, title, summary, difficulty, learning_objectives, content, estimated_minutes, is_published, sort_order, source_references, pillar:learning_pillars(id, slug, title, icon)')
    .eq('slug', slug)
    .maybeSingle();
  if (!lesson) notFound();

  const l = lesson as unknown as Lesson & { pillar: Pick<Pillar, 'id' | 'slug' | 'title' | 'icon'> };

  const [{ data: progress }, { data: siblings }, { data: relatedQuestions }] = await Promise.all([
    supabase.from('lesson_progress').select('status').eq('user_id', viewer.id).eq('lesson_id', l.id).maybeSingle(),
    supabase.from('lessons').select('slug, title, sort_order').eq('pillar_id', l.pillar_id).eq('is_published', true).order('sort_order'),
    supabase.from('quiz_questions').select('id, quiz:quizzes(level, title)').eq('lesson_id', l.id).eq('kind', 'core').limit(3),
  ]);

  const list = siblings ?? [];
  const idx = list.findIndex((s) => s.slug === l.slug);
  const nextLesson = idx >= 0 ? list[idx + 1] : undefined;
  const levels = Array.from(
    new Map(
      ((relatedQuestions ?? []) as unknown as { quiz: { level: number; title: string } | null }[])
        .filter((q) => q.quiz)
        .map((q) => [q.quiz!.level, q.quiz!]),
    ).values(),
  );
  const s = pillarStyle(l.pillar.slug);

  return (
    <div className="container-page">
      <LessonTracker lessonId={l.id} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
          <Link href="/learn" className="link">Lessons</Link> <span aria-hidden>›</span> {l.pillar.title}
        </nav>
        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
              <PillarIcon icon={l.pillar.icon} className="h-4 w-4" /> {l.pillar.title}
            </span>
            <Badge>{l.estimated_minutes} min</Badge>
            <Badge>{l.difficulty}</Badge>
            {!l.is_published ? <Badge tone="amber">Draft (admin preview)</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{l.title}</h1>
          <p className="mt-2 text-lg text-slate-700">{l.summary}</p>
        </header>

        {l.learning_objectives?.length ? (
          <section className="card mt-6">
            <h2 className="font-semibold text-slate-900">By the end of this lesson you will be able to:</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-800">
              {l.learning_objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </section>
        ) : null}

        <div className="mt-8">
          <LessonRenderer blocks={Array.isArray(l.content) ? l.content : []} />
        </div>

        <div className="card mt-10 space-y-4">
          <CompleteLessonForm lessonId={l.id} completed={progress?.status === 'completed'} />
          <div className="flex flex-wrap gap-2">
            {nextLesson ? <Link href={`/learn/${nextLesson.slug}`} className="btn-secondary">Next: {nextLesson.title}</Link> : null}
            {levels.map((q) => (
              <Link key={q.level} href="/quest" className="btn-ghost">Practise in Money Quest Level {q.level}</Link>
            ))}
          </div>
        </div>

        <SourceList sources={l.source_references} />
      </article>
    </div>
  );
}
