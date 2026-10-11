import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../../backend/content/lessons.mjs';
import { COMICS } from '../../../backend/content/comics.mjs';
import { validateBlocks } from '@/lib/content/blocks';
import { validateComicScript } from '@/lib/comics/script';

describe('seeded content works with the frontend', () => {
  it('every lesson renders from valid blocks', () => {
    for (const l of LESSONS) expect(validateBlocks(l.content)).toEqual([]);
  });

  it('every comic script is valid for the admin editor', () => {
    for (const c of COMICS) expect(validateComicScript({ characters: c.characters ?? [], panels: c.panels })).toEqual([]);
  });
});
