import type { ComicPanel, ComicScript } from '@/lib/types';

export type QuestionForScript = {
  title: string;
  prompt: string;
  concept: string;
  misconception: string;
  explanation: string;
  teaching_point: string;
  correct_option_text: string;
  wrong_option_text?: string;
};

const MENTOR = 'Asha Didi';
const STUDENT = 'Dev';

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

/**
 * Deterministic template that turns a quiz question into a 5-panel draft script
 * (situation → misconception → discovery → explanation → takeaway).
 * It is a starting point for an administrator to edit, not finished content.
 */
export function generateComicScript(q: QuestionForScript): ComicScript {
  const wrong = q.wrong_option_text ? clip(q.wrong_option_text, 90) : clip(q.misconception, 90);
  const panels: ComicPanel[] = [
    {
      stage: 'situation',
      setting: 'An everyday scene at home or school in India',
      visual: `Students react to the situation: ${clip(q.prompt, 160)}`,
      dialogue: [{ speaker: STUDENT, line: clip(`Hmm, ${q.title.toLowerCase()}...`, 100) }],
    },
    {
      stage: 'misconception',
      setting: 'Same scene',
      visual: `${STUDENT} confidently picks the tempting choice.`,
      dialogue: [{ speaker: STUDENT, line: clip(`Easy! ${wrong}`, 100) }],
    },
    {
      stage: 'discovery',
      setting: `${MENTOR} joins`,
      visual: `${MENTOR} points to a clue that shows the problem.`,
      dialogue: [{ speaker: MENTOR, line: 'Wait, let\'s check that together.' }],
    },
    {
      stage: 'explanation',
      setting: 'Simple whiteboard or diagram',
      visual: `A clear visual of: ${clip(q.concept || q.explanation, 120)}`,
      dialogue: [{ speaker: MENTOR, line: clip(q.explanation, 105) }],
    },
    {
      stage: 'takeaway',
      setting: 'Both smiling',
      visual: `${STUDENT} writes the lesson in a notebook.`,
      dialogue: [{ speaker: STUDENT, line: clip(q.teaching_point, 100) }],
      caption: clip(q.teaching_point, 140),
    },
  ];
  return { characters: [`${STUDENT} (Class 11 student)`, `${MENTOR} (friendly older cousin)`], panels };
}

/** Text prompt an administrator can paste into ComicsMaker.ai. Contains no student data. */
export function buildComicsMakerPrompt(input: { title: string; script: ComicScript; takeaway: string }): string {
  const lines: string[] = [];
  lines.push(`Create a ${input.script.panels.length}-panel educational comic strip titled "${input.title}".`);
  lines.push('Audience: Indian students aged 15–18. Friendly, clean cartoon style, bright colours, simple backgrounds.');
  lines.push('Use Indian names, settings and rupee (₹) amounts. Keep speech bubbles short and spelled exactly as written.');
  lines.push('Nobody is mocked for making a mistake. Do not show real bank logos or real people.');
  if (input.script.characters.length) {
    lines.push('');
    lines.push('Characters (keep consistent across panels):');
    input.script.characters.forEach((c) => lines.push(`- ${c}`));
  }
  input.script.panels.forEach((p, i) => {
    lines.push('');
    lines.push(`Panel ${i + 1} (${p.stage}) — Setting: ${p.setting}`);
    lines.push(`Visual: ${p.visual}`);
    p.dialogue.forEach((d) => lines.push(`${d.speaker}: "${d.line}"`));
    if (p.caption) lines.push(`Caption: ${p.caption}`);
  });
  lines.push('');
  lines.push(`Final message: ${input.takeaway}`);
  return lines.join('\n');
}

export const COMIC_STAGES: ComicPanel['stage'][] = ['situation', 'misconception', 'discovery', 'explanation', 'takeaway'];

/** Validates an edited script before saving. */
export function validateComicScript(script: unknown): string[] {
  const errors: string[] = [];
  const s = script as ComicScript;
  if (!s || typeof s !== 'object' || !Array.isArray(s.panels)) return ['Script must contain a list of panels.'];
  if (!Array.isArray(s.characters)) errors.push('Characters must be a list.');
  if (s.panels.length < 3 || s.panels.length > 6) errors.push('Use 3 to 6 panels.');
  s.panels.forEach((p, i) => {
    if (!COMIC_STAGES.includes(p?.stage)) errors.push(`Panel ${i + 1}: choose a stage.`);
    if (!p?.visual?.trim()) errors.push(`Panel ${i + 1}: describe the visual.`);
    if (!Array.isArray(p?.dialogue)) errors.push(`Panel ${i + 1}: dialogue must be a list.`);
    else p.dialogue.forEach((d, j) => {
      if (!d?.speaker?.trim() || !d?.line?.trim()) errors.push(`Panel ${i + 1}, line ${j + 1}: needs a speaker and a line.`);
      else if (d.line.length > 140) errors.push(`Panel ${i + 1}, line ${j + 1}: keep speech bubbles under 140 characters.`);
    });
  });
  return errors;
}
