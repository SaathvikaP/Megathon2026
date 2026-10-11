'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toUserMessage, type ActionState } from '@/lib/errors';

const uuid = z.string().uuid();

export async function createJoinCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      orgId: uuid,
      role: z.enum(['student', 'teacher']),
      requiresApproval: z.boolean(),
      maxUses: z.union([z.literal(''), z.coerce.number().int().min(1).max(5000)]),
      expiresInDays: z.coerce.number().int().min(1).max(365),
    })
    .safeParse({
      orgId: formData.get('orgId'),
      role: formData.get('role'),
      requiresApproval: formData.get('requiresApproval') === 'on',
      maxUses: formData.get('maxUses') ?? '',
      expiresInDays: formData.get('expiresInDays') ?? '30',
    });
  if (!parsed.success) return { error: 'Please check the join code settings.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_join_code', {
    p_org_id: parsed.data.orgId,
    p_role: parsed.data.role,
    p_requires_approval: parsed.data.requiresApproval,
    p_max_uses: parsed.data.maxUses === '' ? null : parsed.data.maxUses,
    p_expires_in_days: parsed.data.expiresInDays,
  });
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`/org/${parsed.data.orgId}`);
  return { ok: true, message: `New code created: ${data}` };
}

export async function revokeJoinCodeAction(formData: FormData): Promise<void> {
  const parsed = z.object({ codeId: uuid, orgId: uuid }).safeParse({ codeId: formData.get('codeId'), orgId: formData.get('orgId') });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('revoke_join_code', { p_code_id: parsed.data.codeId });
  revalidatePath(`/org/${parsed.data.orgId}`);
}

export async function reviewMembershipAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({ membershipId: uuid, orgId: uuid, decision: z.enum(['approved', 'rejected', 'revoked']) })
    .safeParse({ membershipId: formData.get('membershipId'), orgId: formData.get('orgId'), decision: formData.get('decision') });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('review_membership', { p_membership_id: parsed.data.membershipId, p_decision: parsed.data.decision });
  revalidatePath(`/org/${parsed.data.orgId}`);
}

export async function setMembershipRoleAction(formData: FormData): Promise<void> {
  const parsed = z
    .object({ membershipId: uuid, orgId: uuid, role: z.enum(['student', 'teacher']) })
    .safeParse({ membershipId: formData.get('membershipId'), orgId: formData.get('orgId'), role: formData.get('role') });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('set_membership_role', { p_membership_id: parsed.data.membershipId, p_role: parsed.data.role });
  revalidatePath(`/org/${parsed.data.orgId}`);
}
