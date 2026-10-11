import { describe, expect, it } from 'vitest';
import { buildAiComicPrompt, buildImageRequestBody, describeImageApiFailure } from '@/lib/comics/ai-request';
import type { ComicScript } from '@/lib/types';

const script: ComicScript = {
  characters: ['Aarav (Class 11)', 'Asha Didi'],
  panels: [
    { stage: 'situation', setting: 'Desk', visual: 'Aarav counts notes.', dialogue: [{ speaker: 'Aarav', line: 'Travel 650, food 450.' }] },
    { stage: 'misconception', setting: 'Desk', visual: 'He forgets savings.', dialogue: [{ speaker: 'Aarav', line: '600 left!' }] },
    { stage: 'takeaway', setting: 'Desk', visual: 'He smiles.', dialogue: [{ speaker: 'Asha Didi', line: 'Count savings too.' }] },
  ],
};

describe('AI comic request', () => {
  it('builds the prompt only from the script', () => {
    const prompt = buildAiComicPrompt({ title: 'Budget check', script, takeaway: 'Include savings.' });
    expect(prompt).toContain('3 panels');
    expect(prompt).toContain('Count savings too.');
    expect(prompt).toContain('Include savings.');
    expect(prompt).not.toMatch(/@|student_identifier|display_name|email|user_id|attempt/i);
  });

  it('sends only the documented generation fields', () => {
    const body = buildImageRequestBody('prompt text', 'gpt-image-1');
    expect(Object.keys(body).sort()).toEqual(['model', 'n', 'output_compression', 'output_format', 'prompt', 'quality', 'size']);
    expect(body.model).toBe('gpt-image-1');
    expect(body.prompt).toBe('prompt text');
    expect(body.n).toBe(1);
  });

  it('describes failures without leaking provider details', () => {
    expect(describeImageApiFailure(401)).toMatch(/key was rejected/);
    expect(describeImageApiFailure(429)).toMatch(/rate limit|quota/);
    expect(describeImageApiFailure(503)).toMatch(/unavailable/);
  });
});
