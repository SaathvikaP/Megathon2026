import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, PageHeader } from '@/components/ui';
import type { Lesson, Pillar } from '@/lib/types';
import { LessonEditor } from './LessonEditor';

export const metadata: Metadata = { title: 'Edit lesson · Admin' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (id !== 'new' && !UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();

  const [{ data: pillars }, lessonRes] = await Promise.all([
    supabase.from('learning_pillars').select('id, title').order('sort_order'),
    id === 'new'
      ? Promise.resolve({ data: null })
      : supabase.from('lessons').select('id, pillar_id, slug, title, summary, difficulty, learning_objectives, content, estimated_minutes, is_published, sort_order, source_references').eq('id', id).maybeSingle(),
  ]);
  if (id !== 'new' && !lessonRes.data) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={id === 'new' ? 'New lesson' : 'Edit lesson'}
        actions={<Link href="/admin/lessons" className="btn-secondary">All lessons</Link>}
      />
      {saved ? <div className="mb-4"><Alert tone="success">Lesson created.</Alert></div> : null}
      <div className="card">
        <LessonEditor lesson={(lessonRes.data as Lesson | null) ?? null} pillars={(pillars ?? []) as Pick<Pillar, 'id' | 'title'>[]} />
      </div>
    </div>
  );
}
