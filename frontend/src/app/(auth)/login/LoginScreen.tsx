'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Butterfly } from '@/components/butterfly/Butterfly';
import { ButterflyField } from '@/components/butterfly/ButterflyField';
import { Alert } from '@/components/ui';
import { SITE } from '@/lib/site';
import { SignInForm } from '../AuthForms';

const FLY_AWAY_MS = 1500;

export function LoginScreen({ next, errorMessage }: { next: string; errorMessage: string | null }) {
  const [leaving, setLeaving] = useState(false);

  const handleSignedIn = useCallback((redirectTo: string) => {
    setLeaving(true);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => window.location.assign(redirectTo), reduceMotion ? 0 : FLY_AWAY_MS);
  }, []);

  return (
    <div className="container-page">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-xl lg:grid-cols-[1.1fr_1fr]">
        <section className="relative min-h-[260px] overflow-hidden bg-gradient-to-b from-brand-400 via-brand-500 to-brand-700 px-8 py-8 text-white lg:min-h-[560px] lg:py-10">
          <ButterflyField count={5} />
          <div className="relative flex h-full flex-col">
            <Image src={SITE.logo.src} alt={SITE.logo.alt} width={240} height={64} className="h-14 w-auto self-start rounded-xl shadow-sm ring-1 ring-white/40" priority />

            <div className="flex flex-1 items-center justify-center py-6">
              <div className={leaving ? 'bf-fly-away' : 'bf-bob'}>
                <Butterfly size={140} color="#ffffff" accent="#4fa77b" />
              </div>
            </div>

            <div className={leaving ? 'bf-fade-up' : ''}>
              <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-sm">
                {leaving ? 'Off you go!' : 'Welcome back'}
              </h1>
              <p className="mt-2 max-w-sm text-brand-50">
                {leaving
                  ? 'Your butterfly is flying ahead to your dashboard.'
                  : 'Budget, save, invest wisely and stay safe from scams — one lesson at a time.'}
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 lg:py-12" aria-labelledby="signin-heading">
          <h2 id="signin-heading" className="text-2xl font-bold text-slate-900">Sign in to {SITE.name}</h2>
          <p className="mt-1 text-slate-700">Students, teachers and admins each go straight to their own dashboard.</p>
          {errorMessage ? <div className="mt-4"><Alert tone="error">{errorMessage}</Alert></div> : null}
          <div className="mt-6">
            <SignInForm next={next} onSignedIn={handleSignedIn} />
          </div>
          <p className="mt-6 rounded-xl bg-brand-50 p-3 text-xs text-brand-900">
            {SITE.name} will never ask for your bank password, card number, UPI PIN or OTP.
          </p>
        </section>
      </div>
    </div>
  );
}
