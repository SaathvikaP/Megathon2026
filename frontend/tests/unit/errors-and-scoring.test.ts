import { describe, expect, it } from 'vitest';
import { errorCode, toUserMessage } from '@/lib/errors';
import { FIRST_ATTEMPT_BONUS, MAX_BASE_POINTS, MAX_TOTAL_POINTS, PASS_THRESHOLD, POINTS_PER_CORRECT, formatPoints } from '@/lib/quest/scoring';

describe('toUserMessage', () => {
  it('maps known database error codes to friendly text', () => {
    expect(toUserMessage({ message: 'level_locked' })).toMatch(/4 out of 5/);
    expect(errorCode({ message: 'too_many_attempts' })).toBe('too_many_attempts');
  });

  it('never forwards raw database messages', () => {
    const raw = { message: 'relation "public.secret_table" does not exist', code: '42P01' };
    expect(toUserMessage(raw)).toBe('Something went wrong. Please try again.');
    expect(toUserMessage({ message: 'new row violates row-level security policy', code: '42501' })).toMatch(/permission/);
  });
});

describe('scoring display constants', () => {
  it('match the specification', () => {
    expect(POINTS_PER_CORRECT).toBe(100);
    expect(FIRST_ATTEMPT_BONUS).toBe(25);
    expect(PASS_THRESHOLD).toBe(4);
    expect(MAX_BASE_POINTS).toBe(1500);
    expect(MAX_TOTAL_POINTS).toBe(1875);
    expect(formatPoints(1875)).toBe('1,875');
  });
});
