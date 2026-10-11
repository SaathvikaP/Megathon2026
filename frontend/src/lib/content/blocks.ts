export { validateBlocks, validateReferences, BLOCK_TYPES, CALLOUT_TONES } from './validate-blocks.mjs';

export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; style: 'bullet' | 'number'; items: string[] }
  | { type: 'definition'; term: string; text: string }
  | { type: 'example'; title: string; text: string; rows?: { label: string; amount: string }[] }
  | { type: 'callout'; tone: 'tip' | 'warning' | 'key'; title: string; text: string }
  | { type: 'activity'; title: string; prompt: string }
  | { type: 'check'; question: string; options: string[]; answerIndex: number; explanation: string };

export type SourceReference = { title: string; publisher?: string; url?: string; note?: string };
