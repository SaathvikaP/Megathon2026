import type { LessonBlock, SourceReference } from '@/lib/content/blocks';
import { SelfCheck } from '@/components/SelfCheck';

const CALLOUT = {
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-rose-200 bg-rose-50 text-rose-950',
  key: 'border-saffron-200 bg-saffron-50 text-slate-900',
};

// Renders structured lesson blocks as plain React text nodes (no HTML injection).
export function LessonRenderer({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="space-y-5 text-[1.05rem] leading-relaxed text-slate-800">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return <h2 key={i} className="pt-2 text-xl font-bold text-slate-900">{b.text}</h2>;
          case 'paragraph':
            return <p key={i}>{b.text}</p>;
          case 'list':
            return b.style === 'number' ? (
              <ol key={i} className="list-decimal space-y-1 pl-6">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-6">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
            );
          case 'definition':
            return (
              <div key={i} className="rounded-xl border-l-4 border-brand-500 bg-white px-4 py-3">
                <p className="font-semibold text-brand-900">{b.term}</p>
                <p className="mt-1">{b.text}</p>
              </div>
            );
          case 'example':
            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Example</p>
                <p className="mt-1 font-semibold text-slate-900">{b.title}</p>
                <p className="mt-1">{b.text}</p>
                {b.rows && b.rows.length > 0 ? (
                  <table className="mt-3 w-full text-sm">
                    <tbody>
                      {b.rows.map((r, j) => (
                        <tr key={j} className="border-t border-slate-100">
                          <th scope="row" className="py-1.5 pr-4 text-left font-normal text-slate-700">{r.label}</th>
                          <td className="py-1.5 text-right font-medium tabular-nums">{r.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            );
          case 'callout':
            return (
              <aside key={i} className={`rounded-2xl border p-4 ${CALLOUT[b.tone] ?? CALLOUT.key}`}>
                <p className="font-semibold">{b.title}</p>
                <p className="mt-1">{b.text}</p>
              </aside>
            );
          case 'activity':
            return (
              <div key={i} className="rounded-2xl border border-dashed border-brand-300 bg-white p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Try it</p>
                <p className="mt-1 font-semibold text-slate-900">{b.title}</p>
                <p className="mt-1">{b.prompt}</p>
              </div>
            );
          case 'check':
            return <SelfCheck key={i} question={b.question} options={b.options} answerIndex={b.answerIndex} explanation={b.explanation} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export function SourceList({ sources }: { sources: SourceReference[] }) {
  if (!sources?.length) return null;
  return (
    <section aria-labelledby="sources-heading" className="mt-8 border-t border-slate-200 pt-4">
      <h2 id="sources-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-600">Further reading</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {sources.map((s, i) => (
          <li key={i}>
            {s.url && s.url.startsWith('https://') ? (
              <a href={s.url} className="link" target="_blank" rel="noopener noreferrer">{s.title}</a>
            ) : (
              <span>{s.title}</span>
            )}
            {s.publisher ? <span className="text-slate-600"> — {s.publisher}</span> : null}
            {s.note ? <span className="block text-slate-600">{s.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
