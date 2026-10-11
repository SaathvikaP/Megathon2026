'use client';

import { useActionState, useEffect } from 'react';
import { FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import { completeLessonAction, startLessonAction } from '../actions';

/** Records that the lesson was opened. Opening never marks a lesson complete. */
export function LessonTracker({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void startLessonAction(lessonId);
  }, [lessonId]);
  return null;
}

export function CompleteLessonForm({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(completeLessonAction, {});
  if (completed || state.ok) {
    return <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-950">You have completed this lesson.</p>;
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="lessonId" value={lessonId} />
      <SubmitButton pendingText="Saving…">I&apos;ve finished this lesson</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
