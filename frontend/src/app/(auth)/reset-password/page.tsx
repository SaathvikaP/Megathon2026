import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '../AuthCard';
import { ResetPasswordForm } from '../AuthForms';
import { getViewer } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) redirect('/setup-required');
  if (!(await getViewer())) redirect('/forgot-password');
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
