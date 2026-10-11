'use client';

import Link from 'next/link';
import { useState } from 'react';

export function MobileNav({ links, signedIn }: { links: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="btn-secondary btn-sm"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      {open ? (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-16 border-b border-slate-200 bg-white shadow-lg">
          <ul className="container-page flex flex-col py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-100" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
            {signedIn ? (
              <>
                <li>
                  <Link href="/profile" className="block rounded-lg px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-100" onClick={() => setOpen(false)}>
                    Profile
                  </Link>
                </li>
                <li>
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="w-full rounded-lg px-3 py-3 text-left text-base font-medium text-slate-800 hover:bg-slate-100">
                      Sign out
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <li><Link href="/login" className="block rounded-lg px-3 py-3 text-base font-medium" onClick={() => setOpen(false)}>Sign in</Link></li>
                <li><Link href="/signup" className="block rounded-lg px-3 py-3 text-base font-medium" onClick={() => setOpen(false)}>Create account</Link></li>
              </>
            )}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
