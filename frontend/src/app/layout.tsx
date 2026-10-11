import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: 'Learn budgeting, saving, investing basics and fraud safety through short lessons and the Money Quest challenge.',
  icons: { icon: SITE.logo.src, apple: SITE.logo.src },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#72C198' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="flex-1 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-sm text-slate-600">
          <div className="container-page flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{SITE.disclaimer}</p>
            <p className="shrink-0">Report cyber fraud: <a className="link" href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a> · 1930</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
