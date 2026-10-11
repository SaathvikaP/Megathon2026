import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '../AuthCard';
import { SignUpForm } from '../AuthForms';
import { getViewer } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage() {
  if (!isSupabaseConfigured()) redirect('/setup-required');
  if (await getViewer()) redirect('/dashboard');
  return (
    <AuthCard title="Create your account" subtitle="Free for students, teachers and organisations. We only ask for what we need.">
      <SignUpForm />
    </AuthCard>
  );
}
