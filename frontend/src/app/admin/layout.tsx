import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/organizations', label: 'Organisations' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/lessons', label: 'Lessons' },
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/comics', label: 'Comics' },
  { href: '/admin/activities', label: 'Activities' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="container-page">
      <nav aria-label="Admin" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
