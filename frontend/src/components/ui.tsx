import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-slate-700">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  gray: 'bg-slate-100 text-slate-800',
  green: 'bg-emerald-100 text-emerald-900',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-900',
  blue: 'bg-brand-100 text-brand-900',
} as const;

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return <span className={`badge ${BADGE_TONES[tone]}`}>{children}</span>;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-md text-slate-700">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

const PILLAR_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  'plan-and-budget': { bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-200' },
  'save-and-manage': { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-200' },
  'understand-investing': { bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-200' },
  'stay-financially-safe': { bg: 'bg-rose-100', text: 'text-rose-900', ring: 'ring-rose-200' },
};

export function pillarStyle(slug: string) {
  return PILLAR_STYLES[slug] ?? { bg: 'bg-slate-100', text: 'text-slate-900', ring: 'ring-slate-200' };
}

export function PillarIcon({ icon, className = 'h-6 w-6' }: { icon: string; className?: string }) {
  const common = { className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, viewBox: '0 0 24 24' };
  switch (icon) {
    case 'wallet':
      return (<svg {...common}><path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z" /><path d="M3 7l12-3v3" /><circle cx="16.5" cy="13.5" r="1.2" /></svg>);
    case 'piggy-bank':
      return (<svg {...common}><path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1a7 6 0 0 1-2 3v3h-3v-2h-3v2H7v-3a6 6 0 0 1-2-6Z" /><path d="M10 7.5h4" /></svg>);
    case 'trending-up':
      return (<svg {...common}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>);
    case 'shield':
      return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="M9 12l2 2 4-4" /></svg>);
    default:
      return (<svg {...common}><path d="M4 5h16v14H4z" /></svg>);
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
