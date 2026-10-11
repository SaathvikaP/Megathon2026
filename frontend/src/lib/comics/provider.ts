import { buildComicsMakerPrompt } from '@/lib/comics/script';
import type { ComicScript } from '@/lib/types';

/**
 * Comic production providers.
 *
 * ComicsMaker.ai (https://www.comicsmaker.ai/) is the intended tool. When this
 * integration was written, no public, documented API could be found, so the only
 * implemented provider is the manual workflow: the admin copies a prompt, creates
 * the comic on the website, then uploads the image here.
 *
 * To add an API provider later, implement `submit` and `poll` server-side, keep the
 * credential in a server-only env var, store the job id in
 * remediation_comics.provider_generation_id and set generation_status to
 * 'generating' / 'asset_uploaded' / 'generation_failed'. The schema already supports it.
 */
export type ComicJobInput = { title: string; script: ComicScript; takeaway: string };

export interface ComicProvider {
  id: 'comicsmaker_manual' | 'comicsmaker_api' | 'other_manual';
  label: string;
  supportsAutomation: boolean;
  buildPrompt(input: ComicJobInput): string;
  submit?(input: ComicJobInput): Promise<{ jobId: string }>;
  poll?(jobId: string): Promise<{ status: 'generating' | 'done' | 'failed'; imageUrl?: string; error?: string }>;
}

export const comicsMakerManualProvider: ComicProvider = {
  id: 'comicsmaker_manual',
  label: 'ComicsMaker.ai (manual)',
  supportsAutomation: false,
  buildPrompt: buildComicsMakerPrompt,
};

export function getComicProvider(id: string | null | undefined): ComicProvider {
  // Only the manual provider exists today; unknown ids fall back to it.
  void id;
  return comicsMakerManualProvider;
}

export const COMICSMAKER_URL = 'https://www.comicsmaker.ai/';
