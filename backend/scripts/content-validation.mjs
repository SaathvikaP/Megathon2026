import { validateBlocks, validateReferences } from '../../frontend/src/lib/content/validate-blocks.mjs';

const STAGES = ['situation', 'misconception', 'discovery', 'explanation', 'takeaway'];

function fail(problems) {
  if (problems.length) {
    throw new Error(`Content validation failed:\n- ${problems.join('\n- ')}`);
  }
}

function checkQuestion(q, label, problems) {
  if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${label}: needs exactly 4 options.`);
  const keys = (q.options ?? []).map((o) => o.key);
  if (new Set(keys).size !== keys.length) problems.push(`${label}: duplicate option keys.`);
  if (!keys.includes(q.correct)) problems.push(`${label}: correct key "${q.correct}" is not an option.`);
  if (!q.explanation || q.explanation.length < 10) problems.push(`${label}: explanation missing.`);
  if (!/^[a-z0-9-]{2,80}$/.test(q.slug)) problems.push(`${label}: invalid slug.`);
}

export function validateContent({ PILLARS, LESSONS, QUIZZES, QUESTIONS, COMICS }) {
  const problems = [];
  const pillarSlugs = new Set(PILLARS.map((p) => p.slug));
  if (pillarSlugs.size !== 4) problems.push('Expected exactly 4 unique learning pillars.');

  const lessonSlugs = new Set();
  for (const l of LESSONS) {
    if (lessonSlugs.has(l.slug)) problems.push(`Duplicate lesson slug ${l.slug}`);
    lessonSlugs.add(l.slug);
    if (!pillarSlugs.has(l.pillar)) problems.push(`Lesson ${l.slug}: unknown pillar ${l.pillar}`);
    for (const e of validateBlocks(l.content)) problems.push(`Lesson ${l.slug}: ${e}`);
    for (const e of validateReferences(l.source_references)) problems.push(`Lesson ${l.slug}: ${e}`);
  }
  for (const p of pillarSlugs) {
    if (!LESSONS.some((l) => l.pillar === p)) problems.push(`Pillar ${p} has no lessons.`);
  }

  const quizSlugs = new Set(QUIZZES.map((z) => z.slug));
  if (QUESTIONS.length !== 15) problems.push(`Expected 15 Money Quest questions, found ${QUESTIONS.length}.`);
  for (const z of QUIZZES) {
    const n = QUESTIONS.filter((q) => q.quiz === z.slug).length;
    if (n !== 5) problems.push(`Level ${z.level} should have 5 questions, has ${n}.`);
  }

  const allSlugs = new Set();
  for (const q of QUESTIONS) {
    const label = `Question ${q.number}`;
    if (!quizSlugs.has(q.quiz)) problems.push(`${label}: unknown quiz ${q.quiz}`);
    if (!lessonSlugs.has(q.lesson)) problems.push(`${label}: unknown lesson ${q.lesson}`);
    checkQuestion(q, label, problems);
    if (!q.practice) problems.push(`${label}: missing practice question.`);
    else checkQuestion(q.practice, `${label} practice`, problems);
    for (const s of [q.slug, q.practice?.slug]) {
      if (allSlugs.has(s)) problems.push(`Duplicate question slug ${s}`);
      allSlugs.add(s);
    }
    for (const e of validateReferences(q.references)) problems.push(`${label}: ${e}`);
  }

  for (const q of QUESTIONS) {
    const comics = COMICS.filter((c) => c.question === q.slug);
    if (comics.length !== 1) problems.push(`Question ${q.number}: expected 1 comic script, found ${comics.length}.`);
  }
  for (const c of COMICS) {
    if (c.panels.length < 3 || c.panels.length > 5) problems.push(`Comic ${c.slug}: needs 3–5 panels.`);
    for (const [i, panel] of c.panels.entries()) {
      if (!STAGES.includes(panel.stage)) problems.push(`Comic ${c.slug} panel ${i + 1}: invalid stage.`);
      if (!panel.visual) problems.push(`Comic ${c.slug} panel ${i + 1}: missing visual description.`);
      for (const d of panel.dialogue) {
        if (d.line.length > 110) problems.push(`Comic ${c.slug} panel ${i + 1}: speech bubble too long.`);
      }
    }
    if (!c.takeaway) problems.push(`Comic ${c.slug}: missing takeaway.`);
    if (!c.alt_text) problems.push(`Comic ${c.slug}: missing alt text.`);
  }

  fail(problems);
  return true;
}
