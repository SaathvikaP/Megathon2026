import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Account suspended' };

export default function AccountSuspendedPage() {
  return (
    <div className="container-page">
      <div className="mx-auto max-w-lg card space-y-3 text-center">
        <h1 className="text-2xl font-bold">Your account is suspended</h1>
        <p className="text-slate-700">
          You cannot use lessons or Money Quest right now. Please contact your teacher, your organisation, or the platform team.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-secondary">Sign out</button>
        </form>
      </div>
    </div>
  );
}
