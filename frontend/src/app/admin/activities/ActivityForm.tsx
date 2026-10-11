'use client';

import { useActionState } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import type { ExternalActivity } from '@/lib/types';
import { saveActivityAction } from './actions';

export function ActivityForm({ activity, pillars }: { activity: ExternalActivity | null; pillars: { id: string; title: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveActivityAction, {});
  const p = activity?.id ?? 'new';
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={p} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`title-${p}`} className="label">Title</label>
          <input id={`title-${p}`} name="title" defaultValue={activity?.title} className="input" required maxLength={140} />
          <FieldError state={state} name="title" />
        </div>
        <div>
          <label htmlFor={`provider-${p}`} className="label">Provider</label>
          <input id={`provider-${p}`} name="provider_name" defaultValue={activity?.provider_name} className="input" maxLength={120} />
        </div>
      </div>
      <div>
        <label htmlFor={`url-${p}`} className="label">Link (https only)</label>
        <input id={`url-${p}`} name="url" type="url" defaultValue={activity?.url} className="input" required placeholder="https://" />
        <FieldError state={state} name="url" />
      </div>
      <div>
        <label htmlFor={`desc-${p}`} className="label">Description</label>
        <textarea id={`desc-${p}`} name="description" defaultValue={activity?.description} className="input" rows={2} maxLength={1000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`pillar-${p}`} className="label">Pillar</label>
          <select id={`pillar-${p}`} name="pillar_id" defaultValue={activity?.pillar_id ?? ''} className="input">
            <option value="">—</option>
            {pillars.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`order-${p}`} className="label">Order</label>
          <input id={`order-${p}`} name="sort_order" type="number" min={0} defaultValue={activity?.sort_order ?? 0} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={activity?.is_published ?? false} className="h-4 w-4" /> Published
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="verified" className="mt-0.5 h-4 w-4" />
        I opened this link today, it goes to the intended provider, and it is suitable for students (no sign-up with bank details, no gambling or trading).
      </label>
      <FieldError state={state} name="verified" />
      <FormMessage state={state} />
      <SubmitButton>{activity ? 'Save activity' : 'Add activity'}</SubmitButton>
    </form>
  );
}
