'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminSupabase, NOT_ADMIN, zodFieldErrors } from '@/lib/admin';
import { toUserMessage, type ActionState } from '@/lib/errors';
import { generateComicScript, validateComicScript } from '@/lib/comics/script';
import { validateComicUpload } from '@/lib/comics/file-validation';
import { COMIC_BUCKET } from '@/lib/comics/assets';
import { buildAiComicPrompt } from '@/lib/comics/ai-request';
import { generateComicImage } from '@/lib/comics/ai-image';
import type { ComicScript } from '@/lib/types';

const uuid = z.string().uuid();
const STUCK_GENERATION_MS = 5 * 60 * 1000;

type AdminClient = NonNullable<Awaited<ReturnType<typeof adminSupabase>>>['supabase'];

/** Validates image bytes, stores them under a server-chosen path and registers them (which sends the comic to review). */
async function storeComicImage(supabase: AdminClient, comicId: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const check = validateComicUpload(bytes);
  if (!check.ok) return { ok: false, error: check.error, field: 'file' };

  const path = `${comicId}/${crypto.randomUUID()}.${check.kind.ext}`;
  const { error: uploadError } = await supabase.storage.from(COMIC_BUCKET).upload(path, bytes, {
    contentType: check.kind.mime,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) return { ok: false, error: 'The image could not be uploaded. Check that the storage bucket exists and try again.' };

  const { data: oldPath, error } = await supabase.rpc('register_comic_asset', {
    p_comic_id: comicId,
    p_path: path,
    p_mime_type: check.kind.mime,
    p_size_bytes: check.size,
  });
  if (error) {
    await supabase.storage.from(COMIC_BUCKET).remove([path]);
    return { ok: false, error: toUserMessage(error) };
  }
  if (typeof oldPath === 'string' && oldPath && oldPath !== path) {
    await supabase.storage.from(COMIC_BUCKET).remove([oldPath]);
  }
  return { ok: true };
}

export async function createComicAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) redirect('/admin/comics');
  const questionId = uuid.safeParse(formData.get('questionId'));
  if (!questionId.success) redirect('/admin/comics?error=invalid');

  const { supabase, viewer } = ctx;
  const [{ data: q }, { data: key }, { data: opts }] = await Promise.all([
    supabase.from('quiz_questions').select('id, slug, title, prompt, topic, concept, misconception, lesson_id, source_references').eq('id', questionId.data).maybeSingle(),
    supabase.from('quiz_answer_keys').select('correct_option_id, explanation, teaching_point').eq('question_id', questionId.data).maybeSingle(),
    supabase.from('quiz_options').select('id, option_text').eq('question_id', questionId.data),
  ]);
  if (!q) redirect('/admin/comics?error=invalid');

  const correctText = opts?.find((o) => o.id === key?.correct_option_id)?.option_text ?? '';
  const script = generateComicScript({
    title: q.title,
    prompt: q.prompt,
    concept: q.concept,
    misconception: q.misconception,
    explanation: key?.explanation ?? '',
    teaching_point: key?.teaching_point || q.concept || q.title,
    correct_option_text: correctText,
    wrong_option_text: opts?.find((o) => o.id !== key?.correct_option_id)?.option_text,
  });

  const { data, error } = await supabase
    .from('remediation_comics')
    .insert({
      question_id: q.id,
      lesson_id: q.lesson_id,
      title: q.title.length >= 3 ? q.title : `Comic: ${q.title}`,
      topic: q.topic,
      concept: q.concept,
      misconception: q.misconception,
      script,
      takeaway: key?.teaching_point ?? '',
      alt_text: '',
      source_references: q.source_references ?? [],
      generation_status: 'script_draft',
      created_by: viewer.id,
    })
    .select('id')
    .single();
  if (error || !data) redirect('/admin/comics?error=create_failed');
  revalidatePath('/admin/comics');
  redirect(`/admin/comics/${data.id}`);
}

export async function saveComicAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;

  const parsed = z
    .object({
      id: uuid,
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().max(1000),
      takeaway: z.string().trim().max(300),
      alt_text: z.string().trim().max(1500),
      generation_status: z.enum(['script_draft', 'script_ready', 'awaiting_asset', 'generating', 'asset_uploaded', 'generation_failed']),
      generation_error: z.string().trim().max(500),
      provider: z.enum(['comicsmaker_manual', 'other_manual', 'openai_images']),
      provider_generation_id: z.string().trim().max(200),
    })
    .safeParse({
      id: formData.get('id'),
      title: formData.get('title'),
      description: formData.get('description') ?? '',
      takeaway: formData.get('takeaway') ?? '',
      alt_text: formData.get('alt_text') ?? '',
      generation_status: formData.get('generation_status'),
      generation_error: formData.get('generation_error') ?? '',
      provider: formData.get('provider'),
      provider_generation_id: formData.get('provider_generation_id') ?? '',
    });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };

  let script: unknown;
  try {
    script = JSON.parse(String(formData.get('script') ?? ''));
  } catch {
    return { fieldErrors: { script: 'The script could not be read. Reload the page and try again.' } };
  }
  const scriptErrors = validateComicScript(script);
  if (scriptErrors.length) return { fieldErrors: { script: scriptErrors.slice(0, 6).join(' ') } };

  const { id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from('remediation_comics')
    .update({
      ...fields,
      generation_error: fields.generation_error || null,
      provider_generation_id: fields.provider_generation_id || null,
      script,
    })
    .eq('id', id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`/admin/comics/${id}`);
  revalidatePath('/admin/comics');
  return { ok: true, message: 'Comic saved. If it was approved, it has gone back to review.' };
}

export async function uploadComicAssetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(formData.get('id'));
  const file = formData.get('file');
  if (!id.success) return { error: 'Invalid comic.' };
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: 'Choose an image to upload.' } };

  // The original file name is never used; storeComicImage chooses the object path.
  const stored = await storeComicImage(ctx.supabase, id.data, new Uint8Array(await file.arrayBuffer()));
  if (!stored.ok) return stored.field ? { fieldErrors: { [stored.field]: stored.error } } : { error: stored.error };
  revalidatePath(`/admin/comics/${id.data}`);
  return { ok: true, message: 'Image uploaded. The comic is now waiting for review.' };
}

export async function generateComicImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return { error: 'Invalid comic.' };
  const { supabase } = ctx;

  const { data: comic } = await supabase
    .from('remediation_comics')
    .select('id, title, takeaway, script, generation_status, updated_at')
    .eq('id', id.data)
    .maybeSingle();
  if (!comic) return { error: 'We could not find that comic.' };

  const startedRecently = comic.generation_status === 'generating' && Date.now() - new Date(comic.updated_at).getTime() < STUCK_GENERATION_MS;
  if (startedRecently) return { error: 'An image is already being generated for this comic. Wait a minute and refresh.' };

  const scriptErrors = validateComicScript(comic.script);
  if (scriptErrors.length) return { error: `Fix the script before generating: ${scriptErrors.slice(0, 3).join(' ')}` };
  if (!comic.takeaway?.trim()) return { error: 'Add a takeaway before generating the image.' };

  await supabase
    .from('remediation_comics')
    .update({ generation_status: 'generating', generation_error: null, provider: 'openai_images' })
    .eq('id', comic.id);

  const prompt = buildAiComicPrompt({ title: comic.title, script: comic.script as ComicScript, takeaway: comic.takeaway });
  const result = await generateComicImage(prompt);
  const fail = async (message: string) => {
    await supabase.from('remediation_comics').update({ generation_status: 'generation_failed', generation_error: message.slice(0, 500) }).eq('id', comic.id);
    revalidatePath(`/admin/comics/${comic.id}`);
    return { error: message };
  };
  if (!result.ok) return fail(result.error);

  const stored = await storeComicImage(supabase, comic.id, result.bytes);
  if (!stored.ok) return fail(stored.error);

  await supabase.from('remediation_comics').update({ provider_generation_id: `openai:${result.model}` }).eq('id', comic.id);
  revalidatePath(`/admin/comics/${comic.id}`);
  revalidatePath('/admin/comics');
  return { ok: true, message: 'Image generated and saved. Check every speech bubble carefully (AI often misspells text) before approving.' };
}

export async function reviewComicAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z
    .object({ id: uuid, decision: z.enum(['draft', 'in_review', 'approved', 'rejected']), note: z.string().max(500) })
    .safeParse({ id: formData.get('id'), decision: formData.get('decision'), note: formData.get('note') ?? '' });
  if (!parsed.success) return;
  const { error } = await ctx.supabase.rpc('review_comic', { p_comic_id: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  revalidatePath(`/admin/comics/${parsed.data.id}`);
  if (error) redirect(`/admin/comics/${parsed.data.id}?error=${encodeURIComponent(error.message)}`);
}

export async function publishComicAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z.object({ id: uuid, publish: z.enum(['true', 'false']) }).safeParse({ id: formData.get('id'), publish: formData.get('publish') });
  if (!parsed.success) return;
  const { error } = await ctx.supabase.rpc('set_comic_published', { p_comic_id: parsed.data.id, p_publish: parsed.data.publish === 'true' });
  revalidatePath(`/admin/comics/${parsed.data.id}`);
  revalidatePath('/admin/comics');
  if (error) redirect(`/admin/comics/${parsed.data.id}?error=${encodeURIComponent(error.message)}`);
}
