'use client';

import { useActionState, useMemo, useState } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import type { ComicPanel, ComicScript, RemediationComic } from '@/lib/types';
import { buildComicsMakerPrompt, COMIC_STAGES } from '@/lib/comics/script';
import { generateComicImageAction, saveComicAction, uploadComicAssetAction } from '../actions';

const emptyPanel = (stage: ComicPanel['stage']): ComicPanel => ({ stage, setting: '', visual: '', dialogue: [{ speaker: '', line: '' }] });

export function ComicEditor({ comic, generatedScript, aiEnabled }: { comic: RemediationComic; generatedScript: ComicScript | null; aiEnabled: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(saveComicAction, {});
  const [script, setScript] = useState<ComicScript>(() => ({
    characters: comic.script?.characters ?? [],
    panels: comic.script?.panels?.length ? comic.script.panels : COMIC_STAGES.map(emptyPanel),
  }));
  const [title, setTitle] = useState(comic.title);
  const [takeaway, setTakeaway] = useState(comic.takeaway);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => buildComicsMakerPrompt({ title, script, takeaway }), [title, script, takeaway]);

  const updatePanel = (i: number, patch: Partial<ComicPanel>) =>
    setScript((s) => ({ ...s, panels: s.panels.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const updateLine = (i: number, j: number, patch: Partial<{ speaker: string; line: string }>) =>
    updatePanel(i, { dialogue: script.panels[i].dialogue.map((d, k) => (k === j ? { ...d, ...patch } : d)) });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      <form action={action} className="card space-y-5">
        <input type="hidden" name="id" value={comic.id} />
        <input type="hidden" name="script" value={JSON.stringify({ ...script, characters: script.characters.map((c) => c.trim()).filter(Boolean) })} />
        <h2 className="text-lg font-bold">1. Script</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" required maxLength={140} />
            <FieldError state={state} name="title" />
          </div>
          <div>
            <label htmlFor="takeaway" className="label">Takeaway (one sentence)</label>
            <input id="takeaway" name="takeaway" value={takeaway} onChange={(e) => setTakeaway(e.target.value)} className="input" maxLength={300} />
          </div>
        </div>
        <div>
          <label htmlFor="characters" className="label">Characters (one per line)</label>
          <textarea
            id="characters"
            className="input"
            rows={2}
            value={script.characters.join('\n')}
            onChange={(e) => setScript((s) => ({ ...s, characters: e.target.value.split('\n') }))}
          />
        </div>

        <ol className="space-y-4">
          {script.panels.map((p, i) => (
            <li key={i} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Panel {i + 1}</p>
                <div className="flex gap-2">
                  <select aria-label={`Panel ${i + 1} stage`} value={p.stage} onChange={(e) => updatePanel(i, { stage: e.target.value as ComicPanel['stage'] })} className="input w-auto">
                    {COMIC_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className="btn-ghost btn-sm" disabled={script.panels.length <= 3}
                    onClick={() => setScript((s) => ({ ...s, panels: s.panels.filter((_, j) => j !== i) }))}>Remove panel</button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`setting-${i}`}>Setting</label>
                  <input id={`setting-${i}`} className="input" value={p.setting} onChange={(e) => updatePanel(i, { setting: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor={`caption-${i}`}>Caption (optional)</label>
                  <input id={`caption-${i}`} className="input" value={p.caption ?? ''} onChange={(e) => updatePanel(i, { caption: e.target.value || undefined })} />
                </div>
              </div>
              <div className="mt-3">
                <label className="label" htmlFor={`visual-${i}`}>Visual description</label>
                <textarea id={`visual-${i}`} className="input" rows={2} value={p.visual} onChange={(e) => updatePanel(i, { visual: e.target.value })} />
              </div>
              <div className="mt-3 space-y-2">
                <p className="label">Speech bubbles</p>
                {p.dialogue.map((d, j) => (
                  <div key={j} className="flex flex-wrap gap-2">
                    <input aria-label="Speaker" placeholder="Speaker" className="input w-40" value={d.speaker} onChange={(e) => updateLine(i, j, { speaker: e.target.value })} />
                    <input aria-label="Line" placeholder="Line (keep it short)" className="input flex-1" maxLength={140} value={d.line} onChange={(e) => updateLine(i, j, { line: e.target.value })} />
                    <button type="button" className="btn-ghost btn-sm" onClick={() => updatePanel(i, { dialogue: p.dialogue.filter((_, k) => k !== j) })}>Remove</button>
                  </div>
                ))}
                <button type="button" className="btn-ghost btn-sm" disabled={p.dialogue.length >= 4}
                  onClick={() => updatePanel(i, { dialogue: [...p.dialogue, { speaker: '', line: '' }] })}>Add speech bubble</button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" disabled={script.panels.length >= 6}
            onClick={() => setScript((s) => ({ ...s, panels: [...s.panels, emptyPanel('explanation')] }))}>Add panel</button>
          {generatedScript ? (
            <button type="button" className="btn-secondary btn-sm"
              onClick={() => { if (window.confirm('Replace the current panels with a freshly generated draft from the question?')) setScript(generatedScript); }}>
              Regenerate draft from question
            </button>
          ) : null}
        </div>
        <FieldError state={state} name="script" />

        <div>
          <label htmlFor="alt_text" className="label">Alt text for the final image</label>
          <textarea id="alt_text" name="alt_text" defaultValue={comic.alt_text} className="input" rows={3} maxLength={1500} />
          <p className="help">Describe each panel and the dialogue so screen-reader users get the same lesson.</p>
        </div>
        <div>
          <label htmlFor="description" className="label">Internal notes (optional)</label>
          <textarea id="description" name="description" defaultValue={comic.description} className="input" rows={2} maxLength={1000} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="generation_status" className="label">Production status</label>
            <select id="generation_status" name="generation_status" defaultValue={comic.generation_status} className="input">
              <option value="script_draft">Script draft</option>
              <option value="script_ready">Script ready</option>
              <option value="awaiting_asset">Being drawn on ComicsMaker.ai</option>
              <option value="asset_uploaded" disabled={!comic.asset_path}>Image uploaded</option>
              <option value="generation_failed">Generation failed</option>
            </select>
          </div>
          <div>
            <label htmlFor="provider" className="label">Made with</label>
            <select id="provider" name="provider" defaultValue={comic.provider === 'comicsmaker_api' ? 'comicsmaker_manual' : comic.provider} className="input">
              <option value="comicsmaker_manual">ComicsMaker.ai (manual)</option>
              <option value="openai_images">AI image API (OpenAI)</option>
              <option value="other_manual">Other tool (manual)</option>
            </select>
          </div>
          <div>
            <label htmlFor="provider_generation_id" className="label">ComicsMaker project reference (optional)</label>
            <input id="provider_generation_id" name="provider_generation_id" defaultValue={comic.provider_generation_id ?? ''} className="input" maxLength={200} />
          </div>
        </div>
        <div>
          <label htmlFor="generation_error" className="label">Problem notes (if generation failed)</label>
          <input id="generation_error" name="generation_error" defaultValue={comic.generation_error ?? ''} className="input" maxLength={500} />
        </div>
        <FormMessage state={state} />
        <SubmitButton>Save comic</SubmitButton>
      </form>

      <AiGenerateForm comicId={comic.id} enabled={aiEnabled} status={comic.generation_status} lastError={comic.generation_error} />

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">2b. Or produce the artwork manually on ComicsMaker.ai</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">
          <li>Save the script above, then copy the prompt below. It contains only the educational script — no student data.</li>
          <li>Open <a href="https://www.comicsmaker.ai/" target="_blank" rel="noopener noreferrer" className="link">ComicsMaker.ai</a> with the team account and create the comic from the prompt.</li>
          <li>Check spelling in every speech bubble and that no real bank logos or real people appear.</li>
          <li>Download the finished strip as PNG, JPEG or WebP (max 5 MB) and upload it in step 3.</li>
        </ol>
        <textarea readOnly value={prompt} className="input font-mono text-xs" rows={12} aria-label="ComicsMaker.ai prompt" />
        <button type="button" className="btn-secondary btn-sm" onClick={copyPrompt}>{copied ? 'Copied!' : 'Copy prompt'}</button>
      </section>

      <UploadForm comicId={comic.id} hasAsset={Boolean(comic.asset_path)} />
    </div>
  );
}

function AiGenerateForm({ comicId, enabled, status, lastError }: {
  comicId: string;
  enabled: boolean;
  status: RemediationComic['generation_status'];
  lastError: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(generateComicImageAction, {});
  return (
    <form action={action} className="card space-y-3 border-brand-200 bg-brand-50/60">
      <h2 className="text-lg font-bold">2a. Generate the artwork with AI</h2>
      <input type="hidden" name="id" value={comicId} />
      {enabled ? (
        <p className="text-sm text-slate-800">
          Save the script first. The server sends only the saved script, title and takeaway to the OpenAI Images API (never student data),
          stores the result privately and sends the comic back to review. Generation can take up to a minute.
        </p>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          AI generation is turned off because no API key is configured. Add <code>OPENAI_API_KEY</code> to <code>frontend/.env.local</code>{' '}
          (server-only, never <code>NEXT_PUBLIC_</code>) and restart the app. Until then, use the manual workflow below.
        </p>
      )}
      {status === 'generation_failed' && lastError && !state.error ? <p className="text-sm text-red-800">Last attempt failed: {lastError}</p> : null}
      <FormMessage state={state} />
      <SubmitButton disabled={!enabled} pendingText="Generating image… this can take a minute">Generate comic image</SubmitButton>
    </form>
  );
}

function UploadForm({ comicId, hasAsset }: { comicId: string; hasAsset: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(uploadComicAssetAction, {});
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-lg font-bold">3. Upload the finished comic</h2>
      <input type="hidden" name="id" value={comicId} />
      <div>
        <label htmlFor="file" className="label">{hasAsset ? 'Replace image' : 'Image file'}</label>
        <input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp" className="block text-sm" required />
        <p className="help">PNG, JPEG or WebP up to 5 MB. The file type is checked from its contents. Uploading sends the comic back to review.</p>
        <FieldError state={state} name="file" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Uploading…">Upload image</SubmitButton>
    </form>
  );
}
