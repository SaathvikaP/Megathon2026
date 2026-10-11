import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '../AuthCard';
import { ForgotPasswordForm } from '../AuthForms';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) redirect('/setup-required');
  return (
    <AuthCard title="Reset your password" subtitle="Enter your account email and we will send you a reset link.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
