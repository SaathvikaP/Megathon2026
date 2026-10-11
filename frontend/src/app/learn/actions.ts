'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toUserMessage, type ActionState } from '@/lib/errors';

const uuid = z.string().uuid();

export async function startLessonAction(lessonId: string): Promise<void> {
  const id = uuid.safeParse(lessonId);
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('start_lesson', { p_lesson_id: id.data });
}

export async function completeLessonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get('lessonId'));
  if (!id.success) return { error: 'Invalid lesson.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('complete_lesson', { p_lesson_id: id.data });
  if (error) return { error: toUserMessage(error) };
  revalidatePath('/learn');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Lesson marked as complete. Nice work!' };
}
