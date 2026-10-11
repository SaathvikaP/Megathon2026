import 'server-only';
import { buildImageRequestBody, DEFAULT_IMAGE_MODEL, describeImageApiFailure, OPENAI_IMAGES_URL } from '@/lib/comics/ai-request';

type AiImageConfig = { apiKey: string; model: string };

/** The key lives only in server env vars (never NEXT_PUBLIC_), so it never reaches the browser. */
function getAiImageConfig(): AiImageConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('your-')) return null;
  return { apiKey, model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL };
}

export function isAiImageConfigured(): boolean {
  return getAiImageConfig() !== null;
}

export type AiImageResult = { ok: true; bytes: Uint8Array; model: string } | { ok: false; error: string };

export async function generateComicImage(prompt: string): Promise<AiImageResult> {
  const config = getAiImageConfig();
  if (!config) return { ok: false, error: 'AI image generation is not configured. Add OPENAI_API_KEY to frontend/.env.local and restart the app.' };

  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildImageRequestBody(prompt, config.model)),
      signal: AbortSignal.timeout(180_000),
      cache: 'no-store',
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return { ok: false, error: timedOut ? 'The image API took too long to respond. Try again.' : 'Could not reach the image API. Check the network connection.' };
  }

  if (!res.ok) return { ok: false, error: describeImageApiFailure(res.status) };

  const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: 'The image API response did not contain an image. Use a GPT Image model (for example gpt-image-1).' };

  return { ok: true, bytes: new Uint8Array(Buffer.from(b64, 'base64')), model: config.model };
}
