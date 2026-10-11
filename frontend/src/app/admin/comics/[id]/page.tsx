import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signComicAsset } from '@/lib/comics/assets';
import { isAiImageConfigured } from '@/lib/comics/ai-image';
import { generateComicScript } from '@/lib/comics/script';
import { ComicStrip } from '@/components/ComicStrip';
import { Alert, Badge, PageHeader, formatDateTime } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { toUserMessage } from '@/lib/errors';
import type { RemediationComic } from '@/lib/types';
import { ComicEditor } from './ComicEditor';
import { publishComicAction, reviewComicAction } from '../actions';

export const metadata: Metadata = { title: 'Edit comic · Admin' };
// AI image generation runs inside this page's server action and can take over a minute.
export const maxDuration = 180;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_TONE = { draft: 'gray', in_review: 'amber', approved: 'green', rejected: 'red' } as const;

export default async function EditComicPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from('remediation_comics').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const comic = data as RemediationComic;

  let generated = null;
  let questionTitle: string | null = null;
  if (comic.question_id) {
    const [{ data: q }, { data: key }, { data: opts }] = await Promise.all([
      supabase.from('quiz_questions').select('id, title, prompt, concept, misconception').eq('id', comic.question_id).maybeSingle(),
      supabase.from('quiz_answer_keys').select('correct_option_id, explanation, teaching_point').eq('question_id', comic.question_id).maybeSingle(),
      supabase.from('quiz_options').select('id, option_text').eq('question_id', comic.question_id),
    ]);
    if (q) {
      questionTitle = q.title;
      generated = generateComicScript({
        title: q.title,
        prompt: q.prompt,
        concept: q.concept,
        misconception: q.misconception,
        explanation: key?.explanation ?? '',
        teaching_point: key?.teaching_point || q.concept || q.title,
        correct_option_text: opts?.find((o) => o.id === key?.correct_option_id)?.option_text ?? '',
        wrong_option_text: opts?.find((o) => o.id !== key?.correct_option_id)?.option_text,
      });
    }
  }
  const imageUrl = await signComicAsset(supabase, comic.asset_path, 60 * 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title={comic.title}
        description={questionTitle ? <>For question: <Link href={`/admin/questions/${comic.question_id}`} className="link">{questionTitle}</Link></> : undefined}
        actions={<Link href="/admin/comics" className="btn-secondary">All comics</Link>}
      />
      {error ? <Alert tone="error">{toUserMessage({ message: error }, 'That action could not be completed.')}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ComicEditor comic={comic} generatedScript={generated} aiEnabled={isAiImageConfigured()} />

        <aside className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-lg font-bold">4. Review and publish</h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone={REVIEW_TONE[comic.review_status]}>Review: {comic.review_status.replace('_', ' ')}</Badge>
              {comic.is_published ? <Badge tone="green">Published {formatDateTime(comic.published_at)}</Badge> : <Badge>Not published</Badge>}
            </div>
            {comic.review_note ? <p className="text-sm text-slate-700">Note: {comic.review_note}</p> : null}
            <form action={reviewComicAction} className="space-y-2">
              <input type="hidden" name="id" value={comic.id} />
              <label htmlFor="note" className="label">Review note</label>
              <input id="note" name="note" className="input" maxLength={500} placeholder="e.g. Fix spelling in panel 3" />
              <div className="flex flex-wrap gap-2">
                {comic.review_status !== 'in_review' ? <SubmitButton name="decision" value="in_review" className="btn-secondary btn-sm" pendingText="…">Submit for review</SubmitButton> : null}
                {comic.review_status !== 'approved' ? <SubmitButton name="decision" value="approved" className="btn-primary btn-sm" pendingText="…">Approve</SubmitButton> : null}
                {comic.review_status !== 'rejected' ? <SubmitButton name="decision" value="rejected" className="btn-secondary btn-sm" pendingText="…">Request changes</SubmitButton> : null}
              </div>
            </form>
            <p className="help">Check: accurate explanation, no real banks or people, no stereotypes, readable text, alt text written.</p>
            <form action={publishComicAction}>
              <input type="hidden" name="id" value={comic.id} />
              <input type="hidden" name="publish" value={comic.is_published ? 'false' : 'true'} />
              {comic.is_published ? (
                <SubmitButton className="btn-secondary w-full" pendingText="…">Unpublish</SubmitButton>
              ) : (
                <SubmitButton className="btn-primary w-full" pendingText="…">Publish to students</SubmitButton>
              )}
            </form>
            <p className="help">Publishing replaces any other published comic for the same question. If no image is uploaded, students see the approved script as text panels.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">Student preview</h2>
            <ComicStrip title={comic.title} takeaway={comic.takeaway} panels={comic.script?.panels ?? null} imageUrl={imageUrl} altText={comic.alt_text || comic.title} />
          </section>
        </aside>
      </div>
    </div>
  );
}
