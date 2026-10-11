import { describe, expect, it } from 'vitest';
import { MAX_COMIC_BYTES, detectImageKind, validateComicUpload } from '@/lib/comics/file-validation';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
const text = (s: string) => new TextEncoder().encode(s);

describe('detectImageKind', () => {
  it('detects PNG, JPEG and WebP from their magic bytes', () => {
    expect(detectImageKind(png)).toEqual({ mime: 'image/png', ext: 'png' });
    expect(detectImageKind(jpeg)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(detectImageKind(webp)).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  it('rejects SVG, HTML, GIF and renamed files', () => {
    expect(detectImageKind(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageKind(text('<!doctype html><html>'))).toBeNull();
    expect(detectImageKind(text('GIF89a......'))).toBeNull();
    expect(detectImageKind(text('RIFF....WAVE'))).toBeNull();
  });
});

describe('validateComicUpload', () => {
  it('accepts a valid image and reports its size', () => {
    expect(validateComicUpload(png)).toEqual({ ok: true, kind: { mime: 'image/png', ext: 'png' }, size: png.length });
  });

  it('rejects empty, oversized and non-image files', () => {
    expect(validateComicUpload(new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_COMIC_BYTES + 1);
    big.set(png);
    expect(validateComicUpload(big).ok).toBe(false);
    expect(validateComicUpload(text('%PDF-1.7')).ok).toBe(false);
  });
});
