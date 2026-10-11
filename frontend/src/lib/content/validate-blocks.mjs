// Dependency-free validator for lesson content blocks.
// Shared by the seed builder (Node) and the admin lesson editor (Next.js).

export const BLOCK_TYPES = ['heading', 'paragraph', 'list', 'definition', 'example', 'callout', 'activity', 'check'];
export const CALLOUT_TONES = ['tip', 'warning', 'key'];

const isText = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/**
 * @param {unknown} blocks
 * @returns {string[]} list of human-readable problems (empty when valid)
 */
export function validateBlocks(blocks) {
  const errors = [];
  if (!Array.isArray(blocks)) return ['Content must be a JSON array of blocks.'];
  if (blocks.length > 80) errors.push('Content has more than 80 blocks.');

  blocks.forEach((b, i) => {
    const at = `Block ${i + 1}`;
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      errors.push(`${at}: must be an object.`);
      return;
    }
    if (!BLOCK_TYPES.includes(b.type)) {
      errors.push(`${at}: unknown type "${b.type}".`);
      return;
    }
    switch (b.type) {
      case 'heading':
      case 'paragraph':
        if (!isText(b.text)) errors.push(`${at}: "text" is required.`);
        break;
      case 'list':
        if (!['bullet', 'number'].includes(b.style)) errors.push(`${at}: "style" must be bullet or number.`);
        if (!Array.isArray(b.items) || b.items.length === 0 || !b.items.every((x) => isText(x, 1000)))
          errors.push(`${at}: "items" must be a non-empty list of text.`);
        break;
      case 'definition':
        if (!isText(b.term, 120)) errors.push(`${at}: "term" is required.`);
        if (!isText(b.text)) errors.push(`${at}: "text" is required.`);
        break;
      case 'example':
        if (!isText(b.title, 200)) errors.push(`${at}: "title" is required.`);
        if (!isText(b.text)) errors.push(`${at}: "text" is required.`);
        if (b.rows !== undefined) {
          if (!Array.isArray(b.rows) || !b.rows.every((r) => r && isText(r.label, 200) && isText(r.amount, 60)))
            errors.push(`${at}: "rows" must be a list of { label, amount }.`);
        }
        break;
      case 'callout':
        if (!CALLOUT_TONES.includes(b.tone)) errors.push(`${at}: "tone" must be tip, warning or key.`);
        if (!isText(b.title, 200)) errors.push(`${at}: "title" is required.`);
        if (!isText(b.text)) errors.push(`${at}: "text" is required.`);
        break;
      case 'activity':
        if (!isText(b.title, 200)) errors.push(`${at}: "title" is required.`);
        if (!isText(b.prompt)) errors.push(`${at}: "prompt" is required.`);
        break;
      case 'check':
        if (!isText(b.question, 1000)) errors.push(`${at}: "question" is required.`);
        if (!Array.isArray(b.options) || b.options.length < 2 || b.options.length > 6 || !b.options.every((o) => isText(o, 300)))
          errors.push(`${at}: "options" must have 2–6 text items.`);
        else if (!Number.isInteger(b.answerIndex) || b.answerIndex < 0 || b.answerIndex >= b.options.length)
          errors.push(`${at}: "answerIndex" must point to one of the options.`);
        if (!isText(b.explanation, 1000)) errors.push(`${at}: "explanation" is required.`);
        break;
    }
  });
  return errors;
}

/** @param {unknown} refs */
export function validateReferences(refs) {
  if (!Array.isArray(refs)) return ['References must be a JSON array.'];
  const errors = [];
  refs.forEach((r, i) => {
    if (!r || typeof r !== 'object') return errors.push(`Reference ${i + 1}: must be an object.`);
    if (!isText(r.title, 300)) errors.push(`Reference ${i + 1}: "title" is required.`);
    if (r.url !== undefined && r.url !== null && !/^https:\/\/[^\s]+$/.test(String(r.url)))
      errors.push(`Reference ${i + 1}: "url" must start with https://`);
  });
  return errors;
}
