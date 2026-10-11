'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminSupabase, NOT_ADMIN, zodFieldErrors } from '@/lib/admin';
import { toUserMessage, type ActionState } from '@/lib/errors';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

const optionalUuid = z.union([z.literal(''), z.string().uuid()]);

export async function saveQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;

  const parsed = z
    .object({
      id: z.union([z.literal('new'), z.string().uuid()]),
      quiz_id: z.string().uuid('Choose a level.'),
      kind: z.enum(['core', 'practice']),
      parent_question_id: optionalUuid,
      slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Use 2–80 lowercase letters, numbers and hyphens.'),
      title: z.string().trim().min(3).max(140),
      prompt: z.string().trim().min(10).max(2000),
      topic: z.string().trim().max(120),
      concept: z.string().trim().max(500),
      misconception: z.string().trim().max(500),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      lesson_id: optionalUuid,
      sort_order: z.coerce.number().int().min(0).max(10000),
      is_published: z.boolean(),
      options: z.array(z.string().trim().min(1, 'Every option needs text.').max(500)).length(OPTION_KEYS.length),
      correct: z.enum(OPTION_KEYS, { errorMap: () => ({ message: 'Choose the correct option.' }) }),
      explanation: z.string().trim().min(10, 'Explain why the answer is correct (10+ characters).').max(2000),
      teaching_point: z.string().trim().max(300),
    })
    .refine((v) => (v.kind === 'practice') === (v.parent_question_id !== ''), {
      path: ['parent_question_id'],
      message: 'Practice questions need a parent core question; core questions must not have one.',
    })
    .refine((v) => new Set(v.options.map((o) => o.toLowerCase())).size === v.options.length, { path: ['options'], message: 'Options must all be different.' })
    .safeParse({
      id: formData.get('id'),
      quiz_id: formData.get('quiz_id'),
      kind: formData.get('kind'),
      parent_question_id: formData.get('parent_question_id') ?? '',
      slug: formData.get('slug'),
      title: formData.get('title'),
      prompt: formData.get('prompt'),
      topic: formData.get('topic') ?? '',
      concept: formData.get('concept') ?? '',
      misconception: formData.get('misconception') ?? '',
      difficulty: formData.get('difficulty'),
      lesson_id: formData.get('lesson_id') ?? '',
      sort_order: formData.get('sort_order'),
      is_published: formData.get('is_published') === 'on',
      options: OPTION_KEYS.map((k) => formData.get(`option_${k}`) ?? ''),
      correct: formData.get('correct'),
      explanation: formData.get('explanation'),
      teaching_point: formData.get('teaching_point') ?? '',
    });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };

  const d = parsed.data;
  const { supabase, viewer } = ctx;
  const questionRow = {
    quiz_id: d.quiz_id,
    kind: d.kind,
    parent_question_id: d.parent_question_id || null,
    slug: d.slug,
    title: d.title,
    prompt: d.prompt,
    topic: d.topic,
    concept: d.concept,
    misconception: d.misconception,
    difficulty: d.difficulty,
    lesson_id: d.lesson_id || null,
    sort_order: d.sort_order,
  };

  let questionId = d.id;
  if (d.id === 'new') {
    // New questions stay unpublished until their options and answer key exist.
    const { data, error } = await supabase.from('quiz_questions').insert({ ...questionRow, is_published: false }).select('id').single();
    if (error) return { error: toUserMessage(error) };
    questionId = data.id;
  } else {
    const { error } = await supabase.from('quiz_questions').update(questionRow).eq('id', d.id);
    if (error) return { error: toUserMessage(error) };
  }

  const { data: options, error: optError } = await supabase
    .from('quiz_options')
    .upsert(
      OPTION_KEYS.map((k, i) => ({ question_id: questionId, option_key: k, option_text: d.options[i], sort_order: i + 1 })),
      { onConflict: 'question_id,option_key' },
    )
    .select('id, option_key');
  if (optError || !options) return { error: toUserMessage(optError, 'The question was saved but its options were not. Please save again.') };

  const correctId = options.find((o) => o.option_key === d.correct)?.id;
  if (!correctId) return { error: 'Could not determine the correct option. Please save again.' };

  const { error: keyError } = await supabase.from('quiz_answer_keys').upsert(
    { question_id: questionId, correct_option_id: correctId, explanation: d.explanation, teaching_point: d.teaching_point, updated_by: viewer.id },
    { onConflict: 'question_id' },
  );
  if (keyError) return { error: toUserMessage(keyError, 'The answer key was not saved. The question stays unpublished.') };

  const { error: pubError } = await supabase.from('quiz_questions').update({ is_published: d.is_published }).eq('id', questionId);
  if (pubError) return { error: toUserMessage(pubError) };

  revalidatePath('/admin/questions');
  if (d.id === 'new') redirect(`/admin/questions/${questionId}?saved=1`);
  return { ok: true, message: d.is_published ? 'Question saved and published.' : 'Question saved as a draft.' };
}
