import { buildComicsMakerPrompt } from '@/lib/comics/script';
import type { ComicScript } from '@/lib/types';

export const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
export const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

/** Prompt for an image-generation model. Built only from the comic script; never includes student data. */
export function buildAiComicPrompt(input: { title: string; script: ComicScript; takeaway: string }): string {
  return [
    `Draw ONE finished comic page with ${input.script.panels.length} panels stacked from top to bottom, each with a thin border.`,
    'Use a soft mint-green and white colour palette. Speech bubbles must contain exactly the words given, in clear English lettering.',
    'No logos, brand names, real people, account numbers, card numbers, UPI PINs or OTPs anywhere in the image.',
    '',
    buildComicsMakerPrompt(input),
  ].join('\n');
}

/** Request body for POST /v1/images/generations (GPT Image models). */
export function buildImageRequestBody(prompt: string, model = DEFAULT_IMAGE_MODEL) {
  return {
    model,
    prompt,
    n: 1,
    size: '1024x1536',
    quality: 'medium',
    output_format: 'webp',
    output_compression: 85,
  } as const;
}

/** Maps API failures to messages that are safe to show admins (no keys, no raw provider payloads). */
export function describeImageApiFailure(status: number): string {
  if (status === 401 || status === 403) return 'The image API key was rejected. Check OPENAI_API_KEY in frontend/.env.local.';
  if (status === 429) return 'The image API rate limit or quota was reached. Try again later or check the account billing.';
  if (status === 400) return 'The image API rejected the request (often a safety filter). Simplify the script and try again.';
  if (status >= 500) return 'The image service is unavailable right now. Try again in a few minutes.';
  return `The image API returned an unexpected response (HTTP ${status}).`;
}
