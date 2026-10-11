'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminSupabase, NOT_ADMIN, zodFieldErrors } from '@/lib/admin';
import { isSafeExternalUrl } from '@/lib/urls';
import { toUserMessage, type ActionState } from '@/lib/errors';

export async function saveActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminSupabase();
  if (!ctx) return NOT_ADMIN;

  const parsed = z
    .object({
      id: z.union([z.literal('new'), z.string().uuid()]),
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().max(1000),
      url: z.string().trim().refine(isSafeExternalUrl, 'Enter a full https:// address without a username or password.'),
      provider_name: z.string().trim().max(120),
      pillar_id: z.union([z.literal(''), z.string().uuid()]),
      sort_order: z.coerce.number().int().min(0).max(10000),
      is_published: z.boolean(),
      verified: z.literal(true, { errorMap: () => ({ message: 'Confirm you opened the link and checked it is appropriate for students.' }) }),
    })
    .safeParse({
      id: formData.get('id'),
      title: formData.get('title'),
      description: formData.get('description') ?? '',
      url: formData.get('url'),
      provider_name: formData.get('provider_name') ?? '',
      pillar_id: formData.get('pillar_id') ?? '',
      sort_order: formData.get('sort_order') ?? '0',
      is_published: formData.get('is_published') === 'on',
      verified: formData.get('verified') === 'on',
    });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };

  const { id, verified: _verified, ...row } = parsed.data;
  void _verified;
  const values = { ...row, pillar_id: row.pillar_id || null };
  const { error } =
    id === 'new'
      ? await ctx.supabase.from('external_activities').insert({ ...values, created_by: ctx.viewer.id })
      : await ctx.supabase.from('external_activities').update(values).eq('id', id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath('/admin/activities');
  revalidatePath('/activities');
  return { ok: true, message: 'Activity saved.' };
}

export async function deleteActivityAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await ctx.supabase.from('external_activities').delete().eq('id', id.data);
  revalidatePath('/admin/activities');
  revalidatePath('/activities');
}
