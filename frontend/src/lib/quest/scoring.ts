// Display copy of the scoring policy. The authoritative implementation is in
// backend/supabase/migrations/20261011000400_money_quest.sql (submit_quiz_answer).
export const POINTS_PER_CORRECT = 100;
export const FIRST_ATTEMPT_BONUS = 25;
export const QUESTIONS_PER_LEVEL = 5;
export const LEVEL_COUNT = 3;
export const PASS_THRESHOLD = 4;

export const MAX_BASE_POINTS = POINTS_PER_CORRECT * QUESTIONS_PER_LEVEL * LEVEL_COUNT; // 1,500
export const MAX_TOTAL_POINTS = (POINTS_PER_CORRECT + FIRST_ATTEMPT_BONUS) * QUESTIONS_PER_LEVEL * LEVEL_COUNT; // 1,875

export function formatPoints(n: number) {
  return new Intl.NumberFormat('en-IN').format(n);
}
