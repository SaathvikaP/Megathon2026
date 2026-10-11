'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth';
import { toUserMessage, type ActionState } from '@/lib/errors';

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Please sign in to continue.' };

  const parsed = z
    .object({
      display_name: z.string().trim().min(2, 'Enter at least 2 characters.').max(80),
      student_identifier: z.string().trim().max(40).regex(/^[A-Za-z0-9 _./-]*$/, 'Use letters, numbers, spaces and - _ . / only.'),
      grade_level: z.enum(['', '11', '12']),
    })
    .safeParse({
      display_name: formData.get('display_name') ?? '',
      student_identifier: formData.get('student_identifier') ?? '',
      grade_level: formData.get('grade_level') ?? '',
    });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.display_name,
      student_identifier: parsed.data.student_identifier || null,
      grade_level: parsed.data.grade_level ? Number(parsed.data.grade_level) : null,
    })
    .eq('id', viewer.id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile saved.' };
}

export async function joinWithCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{8,16}$/.test(code)) return { fieldErrors: { code: 'Join codes are 8–16 letters and numbers.' } };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('join_organization_with_code', { p_code: code });
  if (error) return { error: toUserMessage(error) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.membership_status === 'invalid_code') return { error: toUserMessage({ message: 'invalid_join_code' }) };

  revalidatePath('/', 'layout');
  if (row.membership_status === 'approved') return { ok: true, message: `You are now a member of ${row.organization_name}.` };
  return { ok: true, message: `Request sent to ${row.organization_name}. An organisation admin will review it.` };
}

export async function requestOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(3, 'Enter at least 3 characters.').max(140),
      org_type: z.enum(['school', 'ngo'], { errorMap: () => ({ message: 'Choose school or NGO.' }) }),
      city: z.string().trim().max(80),
      contact_email: z.union([z.literal(''), z.string().trim().email('Enter a valid email.').max(254)]),
      description: z.string().trim().max(1000),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      org_type: formData.get('org_type') ?? '',
      city: formData.get('city') ?? '',
      contact_email: formData.get('contact_email') ?? '',
      description: formData.get('description') ?? '',
    });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('request_organization', {
    p_name: parsed.data.name,
    p_org_type: parsed.data.org_type,
    p_description: parsed.data.description || null,
    p_city: parsed.data.city || null,
    p_contact_email: parsed.data.contact_email || null,
  });
  if (error) return { error: toUserMessage(error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Request submitted. A platform administrator will review it before you can invite members.' };
}

export async function leaveOrganizationAction(formData: FormData): Promise<void> {
  const orgId = z.string().uuid().safeParse(formData.get('orgId'));
  if (!orgId.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc('leave_organization', { p_org_id: orgId.data });
  revalidatePath('/', 'layout');
}
