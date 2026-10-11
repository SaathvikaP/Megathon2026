'use client';

import { useActionState } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import type { Lesson, Pillar } from '@/lib/types';
import { saveLessonAction } from '../actions';

export function LessonEditor({ lesson, pillars }: { lesson: Lesson | null; pillars: Pick<Pillar, 'id' | 'title'>[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLessonAction, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={lesson?.id ?? 'new'} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" name="title" defaultValue={lesson?.title} className="input" required maxLength={140} />
          <FieldError state={state} name="title" />
        </div>
        <div>
          <label htmlFor="slug" className="label">URL slug</label>
          <input id="slug" name="slug" defaultValue={lesson?.slug} className="input font-mono" required pattern="[a-z0-9-]{2,80}" />
          <FieldError state={state} name="slug" />
        </div>
      </div>
      <div>
        <label htmlFor="summary" className="label">Summary</label>
        <textarea id="summary" name="summary" defaultValue={lesson?.summary} className="input" rows={2} maxLength={500} required />
        <FieldError state={state} name="summary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="pillar_id" className="label">Pillar</label>
          <select id="pillar_id" name="pillar_id" defaultValue={lesson?.pillar_id} className="input" required>
            {pillars.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="difficulty" className="label">Difficulty</label>
          <select id="difficulty" name="difficulty" defaultValue={lesson?.difficulty ?? 'beginner'} className="input">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label htmlFor="estimated_minutes" className="label">Minutes</label>
          <input id="estimated_minutes" name="estimated_minutes" type="number" min={1} max={120} defaultValue={lesson?.estimated_minutes ?? 8} className="input" />
        </div>
        <div>
          <label htmlFor="sort_order" className="label">Order</label>
          <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={lesson?.sort_order ?? 100} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="objectives" className="label">Learning objectives (one per line)</label>
        <textarea id="objectives" name="objectives" defaultValue={lesson?.learning_objectives?.join('\n')} className="input" rows={3} />
      </div>
      <div>
        <label htmlFor="content" className="label">Content blocks (JSON)</label>
        <textarea
          id="content"
          name="content"
          defaultValue={JSON.stringify(lesson?.content ?? [{ type: 'paragraph', text: 'Start writing here.' }], null, 2)}
          className="input font-mono text-xs"
          rows={22}
          spellCheck={false}
        />
        <p className="help">Block types: heading, paragraph, list, definition, example, callout (tip | warning | key), activity, check. Content is rendered as plain text, never as HTML.</p>
        <FieldError state={state} name="content" />
      </div>
      <div>
        <label htmlFor="source_references" className="label">Source references (JSON)</label>
        <textarea
          id="source_references"
          name="source_references"
          defaultValue={JSON.stringify(lesson?.source_references ?? [], null, 2)}
          className="input font-mono text-xs"
          rows={6}
          spellCheck={false}
        />
        <p className="help">List of {'{ "title", "publisher", "url" (https only), "note" }'}. Only cite sources you have actually checked.</p>
        <FieldError state={state} name="source_references" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_published" defaultChecked={lesson?.is_published ?? false} className="h-4 w-4" />
        Published (visible to students)
      </label>
      <FormMessage state={state} />
      <SubmitButton>Save lesson</SubmitButton>
    </form>
  );
}
