import type { ReactNode } from 'react';
import Image from 'next/image';
import { SITE } from '@/lib/site';
import { Butterfly } from '@/components/butterfly/Butterfly';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-page">
      <div className="mx-auto max-w-md card border-brand-200 p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <Image
            src={SITE.logo.src}
            alt={SITE.logo.alt}
            width={SITE.logo.width}
            height={SITE.logo.height}
            className="h-12 w-auto rounded-md"
            priority
          />
          <div className="bf-bob">
            <Butterfly size={44} color="#72c198" accent="#ffffff" slow />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-slate-700">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
