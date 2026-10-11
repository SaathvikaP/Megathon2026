import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signComicAsset } from '@/lib/comics/assets';
import { ComicStrip } from '@/components/ComicStrip';
import { Alert, Badge, EmptyState, PageHeader, formatDate } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import type { AnswerFeedback } from '@/lib/types';
import { PracticeQuestionBox } from '../play/[attemptId]/QuizPlayer';

export const metadata: Metadata = { title: 'Review my mistakes' };

type MistakeRow = {
  answer_id: string;
  question_id: string;
  question_title: string;
  level: number;
  answered_at: string;
  remediation_viewed_at: string | null;
  feedback: AnswerFeedback;
};

export default async function MistakesPage() {
  await requireViewer('/quest/mistakes');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_my_mistakes', { p_limit: 30 });
  const rows = (data ?? []) as MistakeRow[];

  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      imageUrl: r.feedback.comic?.asset_path ? await signComicAsset(supabase, r.feedback.comic.asset_path) : null,
    })),
  );

  return (
    <div className="container-page">
      <PageHeader
        title="Review my mistakes"
        description="Questions where your most recent answer was incorrect, with the explanation and the comic for each. Get it right in a later attempt and it disappears from this list."
        actions={<Link href="/quest" className="btn-secondary">Back to Money Quest</Link>}
      />
      {error ? <Alert tone="error">{toUserMessage(error)}</Alert> : null}
      {!error && withUrls.length === 0 ? (
        <EmptyState title="Nothing to review" action={<Link href="/quest" className="btn-primary">Play Money Quest</Link>}>
          You have no outstanding incorrect answers.
        </EmptyState>
      ) : (
        <ul className="space-y-6">
          {withUrls.map((m) => (
            <li key={m.answer_id} className="card space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Level {m.level}</Badge>
                <span className="text-sm text-slate-600">Answered {formatDate(m.answered_at)}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{m.question_title}</h2>
              <p className="text-slate-800">{m.feedback.explanation}</p>
              {m.feedback.teaching_point ? <p className="text-sm font-semibold">Remember: {m.feedback.teaching_point}</p> : null}
              {m.feedback.comic ? (
                <ComicStrip
                  title={m.feedback.comic.title}
                  takeaway={m.feedback.comic.takeaway}
                  panels={m.feedback.comic.panels}
                  imageUrl={m.imageUrl}
                  altText={m.feedback.comic.alt_text}
                />
              ) : (
                <p className="text-sm text-slate-600">A comic for this question has not been published yet.</p>
              )}
              {m.feedback.practice_question_id ? <PracticeQuestionBox questionId={m.feedback.practice_question_id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
