'use client';

import { useId, useState } from 'react';

// Ungraded comprehension check inside a lesson. Never affects points.
export function SelfCheck({ question, options, answerIndex, explanation }: {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const correct = choice === answerIndex;

  return (
    <fieldset className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-brand-800">Quick check (not graded)</legend>
      <p className="font-medium text-slate-900">{question}</p>
      <div className="mt-3 space-y-2">
        {options.map((opt, i) => (
          <label key={i} htmlFor={`${id}-${i}`} className="flex cursor-pointer items-start gap-2 rounded-xl bg-white px-3 py-2">
            <input
              id={`${id}-${i}`}
              type="radio"
              name={id}
              className="mt-1"
              checked={choice === i}
              onChange={() => { setChoice(i); setRevealed(false); }}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      <button type="button" className="btn-secondary btn-sm mt-3" disabled={choice === null} onClick={() => setRevealed(true)}>
        Check
      </button>
      {revealed && choice !== null ? (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${correct ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'}`}>
          <strong>{correct ? 'Correct. ' : `Not quite — the answer is “${options[answerIndex]}”. `}</strong>
          {explanation}
        </p>
      ) : null}
    </fieldset>
  );
}
