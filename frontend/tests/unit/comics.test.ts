import { describe, expect, it } from 'vitest';
import { COMIC_STAGES, buildComicsMakerPrompt, generateComicScript, validateComicScript } from '@/lib/comics/script';
import { comicsMakerManualProvider, getComicProvider } from '@/lib/comics/provider';

const question = {
  title: 'Hidden fee',
  prompt: 'Two funds have the same return before costs, but one charges 2% a year and the other 0.2%. Over 20 years, which grows more?',
  concept: 'Small yearly fees compound into large differences.',
  misconception: 'A 2% fee is too small to matter.',
  explanation: 'Fees are taken every year, so the gap compounds over time and the low-cost fund ends up with noticeably more.',
  teaching_point: 'Compare costs before choosing an investment.',
  correct_option_text: 'The fund with the 0.2% fee',
  wrong_option_text: 'Both grow the same because returns are equal',
};

describe('generateComicScript', () => {
  const script = generateComicScript(question);

  it('produces five panels in the remediation order', () => {
    expect(script.panels.map((p) => p.stage)).toEqual(COMIC_STAGES);
  });

  it('keeps every speech bubble short', () => {
    for (const p of script.panels) for (const d of p.dialogue) expect(d.line.length).toBeLessThanOrEqual(110);
  });

  it('passes its own validation', () => {
    expect(validateComicScript(script)).toEqual([]);
  });
});

describe('validateComicScript', () => {
  it('reports missing panels and empty speech', () => {
    expect(validateComicScript({ characters: [], panels: [] }).length).toBeGreaterThan(0);
    const bad = generateComicScript(question);
    bad.panels[0].dialogue = [{ speaker: '', line: '' }];
    expect(validateComicScript(bad).join(' ')).toMatch(/speaker/);
  });
});

describe('buildComicsMakerPrompt', () => {
  it('contains the script and no student data fields', () => {
    const script = generateComicScript(question);
    const prompt = buildComicsMakerPrompt({ title: 'Hidden fee', script, takeaway: question.teaching_point });
    expect(prompt).toContain('5-panel');
    expect(prompt).toContain('Panel 5 (takeaway)');
    expect(prompt).toContain(question.teaching_point);
    expect(prompt).not.toMatch(/@|student_identifier|display_name|email|user_id|attempt/i);
  });
});

describe('comic provider', () => {
  it('only the manual ComicsMaker.ai workflow is available (no unverified API)', () => {
    expect(getComicProvider('comicsmaker_api')).toBe(comicsMakerManualProvider);
    expect(comicsMakerManualProvider.supportsAutomation).toBe(false);
    expect(comicsMakerManualProvider.submit).toBeUndefined();
  });
});
