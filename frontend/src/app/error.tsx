'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page">
      <div className="mx-auto max-w-lg card text-center" role="alert">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-700">Please try again. If the problem continues, tell your teacher or the platform team.</p>
        <button type="button" onClick={reset} className="btn-primary mt-4">Try again</button>
      </div>
    </div>
  );
}
