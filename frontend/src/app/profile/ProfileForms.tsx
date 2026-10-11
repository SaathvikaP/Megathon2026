'use client';

import { useActionState } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import type { Profile } from '@/lib/types';
import { joinWithCodeAction, requestOrganizationAction, updateProfileAction } from './actions';

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="display_name" className="label">Display name</label>
        <input id="display_name" name="display_name" defaultValue={profile.display_name} className="input" required maxLength={80} />
        <FieldError state={state} name="display_name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="grade_level" className="label">Grade</label>
          <select id="grade_level" name="grade_level" defaultValue={profile.grade_level ? String(profile.grade_level) : ''} className="input">
            <option value="">Prefer not to say / not a student</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>
        </div>
        <div>
          <label htmlFor="student_identifier" className="label">Class / roll number (optional)</label>
          <input id="student_identifier" name="student_identifier" defaultValue={profile.student_identifier ?? ''} className="input" maxLength={40} />
          <p className="help">Only your organisation&apos;s staff can see this. Never enter ID, Aadhaar or bank numbers.</p>
          <FieldError state={state} name="student_identifier" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function JoinCodeForm() {
  const [state, action] = useActionState<ActionState, FormData>(joinWithCodeAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="code" className="label">Join code</label>
        <input id="code" name="code" className="input font-mono uppercase tracking-widest" autoComplete="off" placeholder="e.g. 4F7K2Q9ZXA" required maxLength={20} />
        <p className="help">Your teacher or organisation gives you this code.</p>
        <FieldError state={state} name="code" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Joining…">Join organisation</SubmitButton>
    </form>
  );
}

export function RequestOrgForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestOrganizationAction, {});
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="org-name" className="label">Organisation name</label>
        <input id="org-name" name="name" className="input" required maxLength={140} />
        <FieldError state={state} name="name" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="org_type" className="label">Type</label>
          <select id="org_type" name="org_type" className="input" defaultValue="school">
            <option value="school">School</option>
            <option value="ngo">NGO</option>
          </select>
        </div>
        <div>
          <label htmlFor="city" className="label">City (optional)</label>
          <input id="city" name="city" className="input" maxLength={80} />
        </div>
      </div>
      <div>
        <label htmlFor="contact_email" className="label">Official contact email (optional)</label>
        <input id="contact_email" name="contact_email" type="email" className="input" maxLength={254} />
        <FieldError state={state} name="contact_email" />
      </div>
      <div>
        <label htmlFor="description" className="label">Short description (optional)</label>
        <textarea id="description" name="description" className="input" rows={3} maxLength={1000} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Submitting…">Request organisation</SubmitButton>
    </form>
  );
}
