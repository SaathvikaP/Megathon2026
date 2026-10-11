'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/env';
import { safeNextPath } from '@/lib/urls';
import { homeRouteFor } from '@/lib/home-route';
import type { ActionState } from '@/lib/errors';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email, password: z.string().min(1, 'Enter your password.').max(72) })
    .safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === 'email_not_confirmed') {
      return { error: 'Please confirm your email address first. Check your inbox for the confirmation link.' };
    }
    // Generic message: do not reveal whether the account exists.
    return { error: 'Incorrect email or password.' };
  }

  // The client plays the butterfly animation, then navigates here.
  const explicitNext = safeNextPath(formData.get('next'), '');
  if (explicitNext) return { ok: true, redirectTo: explicitNext };

  const userId = data.user.id;
  const [{ data: profile }, { data: adminRow }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('account_status').eq('id', userId).maybeSingle(),
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase
      .from('organization_memberships')
      .select('organization_id, role, status, created_at, organization:organizations(approval_status)')
      .eq('user_id', userId)
      .order('created_at'),
  ]);
  const redirectTo = homeRouteFor({
    isPlatformAdmin: Boolean(adminRow),
    accountStatus: profile?.account_status ?? 'active',
    memberships: (memberships ?? []) as unknown as Parameters<typeof homeRouteFor>[0]['memberships'],
  });
  return { ok: true, redirectTo };
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      displayName: z.string().trim().min(2, 'Enter at least 2 characters.').max(80),
      email,
      password,
      confirm: z.string(),
      consent: z.literal('on', { errorMap: () => ({ message: 'Please confirm you have read the note above.' }) }),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
    .safeParse({
      displayName: formData.get('displayName'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirm: formData.get('confirm'),
      consent: formData.get('consent'),
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    if (error.code === 'weak_password') return { fieldErrors: { password: 'Choose a stronger password.' } };
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      return { error: 'Too many sign-up attempts. Please wait a few minutes and try again.' };
    }
    return { error: 'We could not create your account. Please try again.' };
  }

  if (data.session) redirect('/dashboard');
  return {
    ok: true,
    message: 'Check your email for a confirmation link to finish creating your account. If you already have an account, sign in instead.',
  };
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Same response whether or not the account exists.
  return { ok: true, message: 'If an account exists for that email, a password reset link is on its way.' };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return { fieldErrors: { password: 'Choose a password you have not used here before.' } };
    return { error: 'We could not update your password. Request a new reset link and try again.' };
  }
  redirect('/dashboard?password=updated');
}
