import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PILLARS } from '../../frontend/src/lib/content/pillars.mjs';
import { LESSONS } from '../content/lessons.mjs';
import { QUIZZES, QUESTIONS } from '../content/money-quest.mjs';
import { COMICS } from '../content/comics.mjs';
import { validateContent } from '../scripts/content-validation.mjs';
import { SEED_PATH, buildSeedSql } from '../scripts/build-seed.mjs';

const EXPECTED = ['B', 'B', 'B', 'A', 'B', 'B', 'B', 'C', 'B', 'C', 'C', 'B', 'C', 'B', 'C'];

describe('learning content', () => {
  it('passes the content validator', () => {
    assert.equal(validateContent({ PILLARS, LESSONS, QUIZZES, QUESTIONS, COMICS }), true);
  });

  it('has the 15 Money Quest questions with the specified answers', () => {
    const sorted = [...QUESTIONS].sort((a, b) => a.number - b.number);
    assert.deepEqual(sorted.map((q) => q.correct), EXPECTED);
    assert.deepEqual(QUIZZES.map((z) => z.level), [1, 2, 3]);
  });

  it('never tells students to use their real account details', () => {
    const all = JSON.stringify({ LESSONS, QUESTIONS, COMICS }).toLowerCase();
    assert.doesNotMatch(all, /(use|enter|type|write|share) (in )?your (own |real |actual )(bank|account|card|upi|pin|otp|password)/);
  });

  it('teaches the PIN rule as a warning', () => {
    const upi = LESSONS.find((l) => l.slug === 'upi-safety-basics');
    assert.match(JSON.stringify(upi?.content ?? ''), /never need your PIN to receive money/);
  });

  it('only links to https sources', () => {
    const urls = JSON.stringify({ LESSONS, QUESTIONS, COMICS }).match(/"url":"[^"]+"/g) ?? [];
    for (const u of urls) assert.match(u, /"url":"https:\/\//);
  });
});

describe('seed migration', () => {
  it('is up to date with backend/content (run npm run db:seed-sql after editing content)', () => {
    assert.equal(readFileSync(SEED_PATH, 'utf8'), buildSeedSql());
  });
});
