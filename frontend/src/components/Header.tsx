import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { getViewer, staffMemberships } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { MobileNav } from '@/components/MobileNav';
import { homeRouteFor } from '@/lib/home-route';

export async function Header() {
  const viewer = isSupabaseConfigured() ? await getViewer() : null;

  const links: { href: string; label: string }[] = viewer
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/learn', label: 'Learn' },
        { href: '/quest', label: 'Money Quest' },
        { href: '/activities', label: 'Activities' },
      ]
    : [];

  if (viewer) {
    const staff = staffMemberships(viewer);
    if (staff.length > 0) links.push({ href: `/org/${staff[0].organization_id}`, label: 'My organisation' });
    if (viewer.isPlatformAdmin) links.push({ href: '/admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href={viewer ? homeRouteFor({ isPlatformAdmin: viewer.isPlatformAdmin, accountStatus: viewer.profile.account_status, memberships: viewer.memberships }) : '/'}
          className="flex items-center"
          aria-label={SITE.name}
        >
          <Image
            src={SITE.logo.src}
            alt={SITE.logo.alt}
            width={SITE.logo.width}
            height={SITE.logo.height}
            className="h-10 w-auto rounded-md"
            priority
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {viewer ? (
            <>
              <Link href="/profile" className="btn-ghost btn-sm" aria-label="Your profile">
                {viewer.profile.display_name || 'Profile'}
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-secondary btn-sm">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
              <Link href="/signup" className="btn-primary btn-sm">Create account</Link>
            </>
          )}
        </div>

        <MobileNav links={links} signedIn={Boolean(viewer)} />
      </div>
    </header>
  );
}
