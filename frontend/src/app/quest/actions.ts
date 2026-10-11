'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errorCode, toUserMessage } from '@/lib/errors';
import { signComicAsset } from '@/lib/comics/assets';
import type { AnswerFeedback } from '@/lib/types';

const uuid = z.string().uuid();

export async function beginQuizAction(formData: FormData): Promise<void> {
  const quizId = uuid.safeParse(formData.get('quizId'));
  if (!quizId.success) redirect('/quest?error=not_found');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('start_quiz_attempt', { p_quiz_id: quizId.data });
  if (error || !data?.attempt_id) {
    redirect(`/quest?error=${errorCode(error) ?? 'unknown'}`);
  }
  redirect(`/quest/play/${data.attempt_id}`);
}

async function withComicUrl(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, feedback: AnswerFeedback) {
  if (feedback.comic?.asset_path) {
    feedback.comic.image_url = await signComicAsset(supabase, feedback.comic.asset_path);
  }
  return feedback;
}

export type SubmitResult = { ok: true; feedback: AnswerFeedback } | { ok: false; error: string };

export async function submitAnswerAction(attemptId: string, questionId: string, optionId: string): Promise<SubmitResult> {
  const parsed = z.object({ attemptId: uuid, questionId: uuid, optionId: uuid }).safeParse({ attemptId, questionId, optionId });
  if (!parsed.success) return { ok: false, error: 'Please choose one of the listed answers.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('submit_quiz_answer', {
    p_attempt_id: parsed.data.attemptId,
    p_question_id: parsed.data.questionId,
    p_option_id: parsed.data.optionId,
  });
  if (error || !data) return { ok: false, error: toUserMessage(error) };

  const feedback = await withComicUrl(supabase, data as AnswerFeedback);
  if (feedback.attempt_summary) {
    revalidatePath('/quest');
    revalidatePath('/dashboard');
  }
  return { ok: true, feedback };
}

export type PracticeQuestion = { id: string; title: string; prompt: string; options: { id: string; option_key: string; option_text: string }[] };

export async function loadPracticeAction(questionId: string): Promise<PracticeQuestion | null> {
  const id = uuid.safeParse(questionId);
  if (!id.success) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('quiz_questions')
    .select('id, title, prompt, kind, options:quiz_options(id, option_key, option_text, sort_order)')
    .eq('id', id.data)
    .eq('kind', 'practice')
    .maybeSingle();
  if (!data) return null;
  const options = [...(data.options ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return { id: data.id, title: data.title, prompt: data.prompt, options: options.map(({ id, option_key, option_text }) => ({ id, option_key, option_text })) };
}

export type PracticeResult =
  | { ok: true; is_correct: boolean; correct_option_id: string; explanation: string; teaching_point: string }
  | { ok: false; error: string };

export async function checkPracticeAction(questionId: string, optionId: string): Promise<PracticeResult> {
  const parsed = z.object({ questionId: uuid, optionId: uuid }).safeParse({ questionId, optionId });
  if (!parsed.success) return { ok: false, error: 'Please choose one of the listed answers.' };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('check_practice_answer', { p_question_id: parsed.data.questionId, p_option_id: parsed.data.optionId });
  if (error || !data) return { ok: false, error: toUserMessage(error) };
  return { ok: true, ...data };
}

export async function markRemediationViewedAction(answerId: string): Promise<void> {
  const id = uuid.safeParse(answerId);
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('mark_remediation_viewed', { p_answer_id: id.data });
}
