'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminSupabase } from '@/lib/admin';

const uuid = z.string().uuid();

export async function reviewOrganizationAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z
    .object({ orgId: uuid, decision: z.enum(['approved', 'rejected', 'suspended', 'pending']), note: z.string().max(500) })
    .safeParse({ orgId: formData.get('orgId'), decision: formData.get('decision'), note: formData.get('note') ?? '' });
  if (!parsed.success) return;
  await ctx.supabase.rpc('review_organization', { p_org_id: parsed.data.orgId, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  revalidatePath('/admin/organizations');
}

export async function setPlatformAdminAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z.object({ userId: uuid, grant: z.enum(['true', 'false']) }).safeParse({ userId: formData.get('userId'), grant: formData.get('grant') });
  if (!parsed.success) return;
  await ctx.supabase.rpc('admin_set_platform_admin', { p_user_id: parsed.data.userId, p_grant: parsed.data.grant === 'true' });
  revalidatePath('/admin/users');
}

export async function setAccountStatusAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z.object({ userId: uuid, status: z.enum(['active', 'suspended']) }).safeParse({ userId: formData.get('userId'), status: formData.get('status') });
  if (!parsed.success) return;
  await ctx.supabase.rpc('admin_set_account_status', { p_user_id: parsed.data.userId, p_status: parsed.data.status });
  revalidatePath('/admin/users');
}

export async function adminSetMembershipRoleAction(formData: FormData): Promise<void> {
  const ctx = await adminSupabase();
  if (!ctx) return;
  const parsed = z
    .object({ membershipId: uuid, role: z.enum(['student', 'teacher', 'organization_admin']) })
    .safeParse({ membershipId: formData.get('membershipId'), role: formData.get('role') });
  if (!parsed.success) return;
  await ctx.supabase.rpc('set_membership_role', { p_membership_id: parsed.data.membershipId, p_role: parsed.data.role });
  revalidatePath('/admin/organizations');
}
