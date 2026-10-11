import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Admin' };

type Stats = Record<
  | 'users' | 'active_learners' | 'organizations_pending' | 'organizations_approved' | 'lessons_published' | 'lessons_total'
  | 'lessons_completed' | 'questions_core' | 'attempts_completed' | 'attempts_passed' | 'comics_published'
  | 'comics_awaiting_review' | 'comics_failed',
  number
>;

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_platform_stats');
  const s = data as Stats | null;

  const cards: { label: string; value: number | string; href?: string }[] = s
    ? [
        { label: 'Registered users', value: s.users, href: '/admin/users' },
        { label: 'Learners who answered a question', value: s.active_learners },
        { label: 'Organisations awaiting review', value: s.organizations_pending, href: '/admin/organizations' },
        { label: 'Approved organisations', value: s.organizations_approved, href: '/admin/organizations' },
        { label: 'Published lessons', value: `${s.lessons_published} / ${s.lessons_total}`, href: '/admin/lessons' },
        { label: 'Lesson completions', value: s.lessons_completed },
        { label: 'Core quiz questions', value: s.questions_core, href: '/admin/questions' },
        { label: 'Completed quiz attempts', value: s.attempts_completed },
        { label: 'Passed attempts', value: s.attempts_passed },
        { label: 'Published comics', value: s.comics_published, href: '/admin/comics' },
        { label: 'Comics awaiting review', value: s.comics_awaiting_review, href: '/admin/comics' },
        { label: 'Comic generation failures', value: s.comics_failed, href: '/admin/comics' },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Platform overview" description="Live counts from the database." />
      {error ? <Alert tone="error">Could not load statistics.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <>
              <p className="text-sm text-slate-600">{c.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{c.value}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="card block hover:border-brand-300">{body}</Link>
          ) : (
            <div key={c.label} className="card">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
