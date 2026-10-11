import Image from 'next/image';
import Link from 'next/link';
import { PillarIcon, pillarStyle } from '@/components/ui';
import { SITE } from '@/lib/site';
import { MAX_TOTAL_POINTS, formatPoints } from '@/lib/quest/scoring';
import { PILLARS } from '@/lib/content/pillars.mjs';
import { ButterflyField } from '@/components/butterfly/ButterflyField';

export default function HomePage() {
  return (
    <div className="container-page space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <div>
          <Image
            src={SITE.logo.src}
            alt={SITE.logo.alt}
            width={280}
            height={72}
            className="h-14 w-auto rounded-lg sm:h-16"
            priority
          />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Money skills you will actually use.
          </h1>
          <p className="mt-4 text-lg text-slate-700">
            {SITE.name} teaches budgeting, saving, the basics of investing and how to stay safe from fraud through short
            lessons, a three-level Money Quest, and comic strips that explain common mistakes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">Start learning — it&apos;s free</Link>
            <Link href="/login" className="btn-secondary">I already have an account</Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Schools and NGOs can request an organisation workspace after signing up and invite students with a join code.
          </p>
        </div>
        <div className="card relative overflow-hidden border-brand-600 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 p-6 text-white">
          <ButterflyField count={3} accent="#2f6f51" />
          <div className="relative">
          <h2 className="text-xl font-bold">Money Quest</h2>
          <p className="mt-2 text-brand-100">Three levels, five questions each. Unlock the next level by getting at least 4 of 5 right.</p>
          <ol className="mt-5 space-y-3">
            {['Money Rookie', 'Smart Money Strategist', 'Financial Detective'].map((name, i) => (
              <li key={name} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-saffron-400 font-bold text-brand-950">{i + 1}</span>
                <span className="font-semibold">{name}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-brand-100">
            100 points for each correct answer, plus a 25-point bonus when you get a question right the first time — up to {formatPoints(MAX_TOTAL_POINTS)} points.
          </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="pillars-heading">
        <h2 id="pillars-heading" className="text-2xl font-bold text-slate-900">Four learning pillars</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => {
            const s = pillarStyle(p.slug);
            return (
              <div key={p.slug} className="card">
                <div className={`inline-grid h-11 w-11 place-items-center rounded-xl ${s.bg} ${s.text}`}>
                  <PillarIcon icon={p.icon} />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{p.tagline}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card border-rose-200 bg-rose-50">
        <h2 className="text-lg font-bold text-rose-950">A note on safety</h2>
        <p className="mt-2 text-rose-950">
          This platform never asks for your bank account number, card details, UPI PIN or OTP — and nobody genuine ever will.
          All examples here use made-up names and amounts.
        </p>
      </section>
    </div>
  );
}
