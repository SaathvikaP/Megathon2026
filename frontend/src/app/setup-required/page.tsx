import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, EXPECTED_PROJECT_REF } from '@/lib/env';

export const metadata: Metadata = { title: 'Setup required' };

export default function SetupRequiredPage() {
  if (isSupabaseConfigured()) redirect('/dashboard');
  return (
    <div className="container-page">
      <div className="mx-auto max-w-2xl card space-y-4">
        <h1 className="text-2xl font-bold">Supabase is not configured</h1>
        <p className="text-slate-700">
          This app needs the shared Supabase project <code className="rounded bg-slate-100 px-1">{EXPECTED_PROJECT_REF}</code>.
          No data is shown until it is connected.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-slate-800">
          <li>Copy <code className="rounded bg-slate-100 px-1">frontend/.env.example</code> to <code className="rounded bg-slate-100 px-1">frontend/.env.local</code>.</li>
          <li>
            In the Supabase dashboard, open <strong>Project Settings → API</strong> and copy the Project URL and the
            <strong> anon / publishable</strong> key into <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and
            <code className="rounded bg-slate-100 px-1"> NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </li>
          <li>Never put the service-role / secret key or the database password in this file — the app does not use them.</li>
          <li>Restart <code className="rounded bg-slate-100 px-1">npm run dev</code>.</li>
        </ol>
        <p className="text-sm text-slate-600">See <code>docs/DATABASE_SETUP.md</code> for full instructions.</p>
      </div>
    </div>
  );
}
