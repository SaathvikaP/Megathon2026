export const MAX_COMIC_BYTES = 5 * 1024 * 1024;

export type ImageKind = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp' };

/** Detects the image type from its leading bytes; file names and declared MIME types are not trusted. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export type UploadCheck = { ok: true; kind: ImageKind; size: number } | { ok: false; error: string };

export function validateComicUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: 'Choose an image to upload.' };
  if (bytes.length > MAX_COMIC_BYTES) return { ok: false, error: 'Images must be 5 MB or smaller.' };
  const kind = detectImageKind(bytes);
  if (!kind) return { ok: false, error: 'Only PNG, JPEG or WebP images are allowed.' };
  return { ok: true, kind, size: bytes.length };
}
