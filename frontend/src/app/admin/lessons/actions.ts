'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminSupabase, NOT_ADMIN, zodFieldErrors } from '@/lib/admin';
import { validateBlocks, validateReferences } from '@/lib/content/blocks';
import { toUserMessage, type ActionState } from '@/lib/errors';

function parseJson(value: FormDataEntryValue | null): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(String(value ?? '')) };
  } catch {
    return { ok: false };
  }
}

export async function saveLessonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;

  const parsed = z
    .object({
      id: z.union([z.literal('new'), z.string().uuid()]),
      pillar_id: z.string().uuid('Choose a pillar.'),
      slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Use 2–80 lowercase letters, numbers and hyphens.'),
      title: z.string().trim().min(3).max(140),
      summary: z.string().trim().min(10, 'Write a short summary (10+ characters).').max(500),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      estimated_minutes: z.coerce.number().int().min(1).max(120),
      sort_order: z.coerce.number().int().min(0).max(10000),
      is_published: z.boolean(),
      objectives: z.string().max(4000),
    })
    .safeParse({
      id: formData.get('id'),
      pillar_id: formData.get('pillar_id'),
      slug: formData.get('slug'),
      title: formData.get('title'),
      summary: formData.get('summary'),
      difficulty: formData.get('difficulty'),
      estimated_minutes: formData.get('estimated_minutes'),
      sort_order: formData.get('sort_order'),
      is_published: formData.get('is_published') === 'on',
      objectives: formData.get('objectives') ?? '',
    });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };

  const content = parseJson(formData.get('content'));
  if (!content.ok) return { fieldErrors: { content: 'Content is not valid JSON.' } };
  const blockErrors = validateBlocks(content.value);
  if (blockErrors.length) return { fieldErrors: { content: blockErrors.slice(0, 5).join(' ') } };

  const refs = parseJson(formData.get('source_references'));
  if (!refs.ok) return { fieldErrors: { source_references: 'References are not valid JSON.' } };
  const refErrors = validateReferences(refs.value);
  if (refErrors.length) return { fieldErrors: { source_references: refErrors.slice(0, 5).join(' ') } };

  const { id, objectives, ...fields } = parsed.data;
  const row = {
    ...fields,
    learning_objectives: objectives.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12),
    content: content.value,
    source_references: refs.value,
  };

  if (id === 'new') {
    const { data, error } = await ctx.supabase.from('lessons').insert(row).select('id').single();
    if (error) return { error: toUserMessage(error) };
    revalidatePath('/admin/lessons');
    redirect(`/admin/lessons/${data.id}?saved=1`);
  }

  const { error } = await ctx.supabase.from('lessons').update(row).eq('id', id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath('/admin/lessons');
  revalidatePath('/learn', 'layout');
  return { ok: true, message: 'Lesson saved.' };
}
