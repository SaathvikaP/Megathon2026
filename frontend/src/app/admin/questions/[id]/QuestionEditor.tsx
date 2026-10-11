'use client';

import { useActionState, useState } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import { saveQuestionAction } from '../actions';

const KEYS = ['A', 'B', 'C', 'D'] as const;

export type EditableQuestion = {
  id: string; quiz_id: string; kind: 'core' | 'practice'; parent_question_id: string | null; slug: string; title: string; prompt: string;
  topic: string; concept: string; misconception: string; difficulty: string; lesson_id: string | null; sort_order: number; is_published: boolean;
  options: Record<string, string>; correct: string | null; explanation: string; teaching_point: string;
};

export function QuestionEditor({ question, quizzes, lessons, coreQuestions, hasAnswers }: {
  question: EditableQuestion | null;
  quizzes: { id: string; level: number; title: string }[];
  lessons: { id: string; title: string }[];
  coreQuestions: { id: string; title: string; quiz_id: string }[];
  hasAnswers: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveQuestionAction, {});
  const [kind, setKind] = useState<'core' | 'practice'>(question?.kind ?? 'core');

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={question?.id ?? 'new'} />
      {hasAnswers ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Students have already answered this question. Changing the correct option does not re-grade past answers; fix wording carefully.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="quiz_id" className="label">Level</label>
          <select id="quiz_id" name="quiz_id" defaultValue={question?.quiz_id} className="input">
            {quizzes.map((q) => <option key={q.id} value={q.id}>Level {q.level}: {q.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="kind" className="label">Kind</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'core' | 'practice')} className="input">
            <option value="core">Core (graded)</option>
            <option value="practice">Practice (ungraded)</option>
          </select>
        </div>
        <div>
          <label htmlFor="parent_question_id" className="label">Parent core question</label>
          <select id="parent_question_id" name="parent_question_id" defaultValue={question?.parent_question_id ?? ''} className="input" disabled={kind === 'core'}>
            <option value="">—</option>
            {coreQuestions.filter((c) => c.id !== question?.id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <FieldError state={state} name="parent_question_id" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="label">Short title</label>
          <input id="title" name="title" defaultValue={question?.title} className="input" required maxLength={140} />
          <FieldError state={state} name="title" />
        </div>
        <div>
          <label htmlFor="slug" className="label">Slug</label>
          <input id="slug" name="slug" defaultValue={question?.slug} className="input font-mono" required />
          <FieldError state={state} name="slug" />
        </div>
      </div>
      <div>
        <label htmlFor="prompt" className="label">Question</label>
        <textarea id="prompt" name="prompt" defaultValue={question?.prompt} className="input" rows={4} required maxLength={2000} />
        <FieldError state={state} name="prompt" />
      </div>

      <fieldset className="rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Options and correct answer</legend>
        <div className="space-y-2">
          {KEYS.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="correct" value={k} defaultChecked={question?.correct === k} required />
                <span className="sr-only">Mark option {k} correct</span>
              </label>
              <label htmlFor={`option_${k}`} className="w-6 font-bold">{k}</label>
              <input id={`option_${k}`} name={`option_${k}`} defaultValue={question?.options[k] ?? ''} className="input" required maxLength={500} />
            </div>
          ))}
        </div>
        <p className="help">Select the radio button next to the correct option.</p>
        <FieldError state={state} name="options" />
        <FieldError state={state} name="correct" />
      </fieldset>

      <div>
        <label htmlFor="explanation" className="label">Explanation (shown after answering)</label>
        <textarea id="explanation" name="explanation" defaultValue={question?.explanation} className="input" rows={3} required maxLength={2000} />
        <FieldError state={state} name="explanation" />
      </div>
      <div>
        <label htmlFor="teaching_point" className="label">Teaching point (one sentence)</label>
        <input id="teaching_point" name="teaching_point" defaultValue={question?.teaching_point} className="input" maxLength={300} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="concept" className="label">Concept tested</label>
          <input id="concept" name="concept" defaultValue={question?.concept} className="input" maxLength={500} />
        </div>
        <div>
          <label htmlFor="misconception" className="label">Common misconception</label>
          <input id="misconception" name="misconception" defaultValue={question?.misconception} className="input" maxLength={500} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="topic" className="label">Topic</label>
          <input id="topic" name="topic" defaultValue={question?.topic} className="input" maxLength={120} />
        </div>
        <div>
          <label htmlFor="difficulty" className="label">Difficulty</label>
          <select id="difficulty" name="difficulty" defaultValue={question?.difficulty ?? 'beginner'} className="input">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label htmlFor="lesson_id" className="label">Related lesson</label>
          <select id="lesson_id" name="lesson_id" defaultValue={question?.lesson_id ?? ''} className="input">
            <option value="">—</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort_order" className="label">Order</label>
          <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={question?.sort_order ?? 100} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_published" defaultChecked={question?.is_published ?? false} className="h-4 w-4" />
        Published
      </label>
      <FormMessage state={state} />
      <SubmitButton>Save question</SubmitButton>
    </form>
  );
}
