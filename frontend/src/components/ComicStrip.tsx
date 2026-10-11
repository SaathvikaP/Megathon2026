import type { ComicPanel } from '@/lib/types';

const STAGE_LABEL: Record<ComicPanel['stage'], string> = {
  situation: 'The situation',
  misconception: 'The mistake',
  discovery: 'The discovery',
  explanation: 'What is really going on',
  takeaway: 'The takeaway',
};

/**
 * Shows a remediation comic: the reviewed image when one has been uploaded,
 * otherwise the approved script rendered as text panels.
 */
export function ComicStrip({ title, takeaway, panels, imageUrl, altText }: {
  title: string;
  takeaway: string;
  panels: ComicPanel[] | null;
  imageUrl?: string | null;
  altText: string;
}) {
  return (
    <figure className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0_0_#0f172a]">
      <figcaption className="mb-3 text-lg font-extrabold text-slate-900">{title}</figcaption>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
        <img src={imageUrl} alt={altText} className="w-full rounded-lg border border-slate-200" loading="lazy" />
      ) : panels && panels.length > 0 ? (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Comic panels">
          {panels.map((p, i) => (
            <li key={i} className="flex flex-col rounded-xl border-2 border-slate-800 bg-amber-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Panel {i + 1} · {STAGE_LABEL[p.stage] ?? p.stage}
              </p>
              <p className="mt-1 text-xs italic text-slate-600">{p.setting}</p>
              <div className="mt-2 space-y-2">
                {p.dialogue.map((d, j) => (
                  <p key={j} className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                    <span className="font-bold">{d.speaker}: </span>{d.line}
                  </p>
                ))}
              </div>
              {p.caption ? <p className="mt-2 text-xs font-semibold text-slate-700">{p.caption}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="mt-4 rounded-xl bg-saffron-100 px-3 py-2 text-sm font-semibold text-slate-900">Takeaway: {takeaway}</p>
    </figure>
  );
}
