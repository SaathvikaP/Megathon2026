'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import { createJoinCodeAction } from './actions';

export function CreateJoinCodeForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createJoinCodeAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="role" className="label">Joins as</label>
          <select id="role" name="role" className="input" defaultValue="student">
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>
        <div>
          <label htmlFor="expiresInDays" className="label">Expires after (days)</label>
          <input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} defaultValue={30} className="input" required />
        </div>
        <div>
          <label htmlFor="maxUses" className="label">Maximum uses (optional)</label>
          <input id="maxUses" name="maxUses" type="number" min={1} max={5000} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requiresApproval" defaultChecked className="h-4 w-4" />
        Require my approval before people who use this code join
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create join code</SubmitButton>
    </form>
  );
}
