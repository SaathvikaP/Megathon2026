import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page">
      <div className="mx-auto max-w-lg card text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-700">The page does not exist, or you do not have access to it.</p>
        <Link href="/" className="btn-primary mt-4">Go home</Link>
      </div>
    </div>
  );
}
