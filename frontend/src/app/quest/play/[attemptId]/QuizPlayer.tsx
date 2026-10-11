'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ComicStrip } from '@/components/ComicStrip';
import { Alert, ProgressBar } from '@/components/ui';
import { formatPoints } from '@/lib/quest/scoring';
import type { AnswerFeedback, AttemptSummary, QuizAttempt } from '@/lib/types';
import {
  checkPracticeAction,
  loadPracticeAction,
  markRemediationViewedAction,
  submitAnswerAction,
  type PracticeQuestion,
  type PracticeResult,
} from '../../actions';

export type PlayerOption = { id: string; option_key: string; option_text: string };
export type PlayerQuestion = { id: string; title: string; prompt: string; options: PlayerOption[] };

export function QuizPlayer({ attemptId, questions, initiallyAnswered, completedAttempt, passThreshold }: {
  attemptId: string;
  questions: PlayerQuestion[];
  initiallyAnswered: Record<string, boolean>;
  completedAttempt: QuizAttempt | null;
  passThreshold: number;
}) {
  const [answered, setAnswered] = useState<Record<string, boolean>>(initiallyAnswered);
  const [currentId, setCurrentId] = useState<string | null>(() => questions.find((q) => !(q.id in initiallyAnswered))?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = useMemo(() => questions.find((q) => q.id === currentId) ?? null, [questions, currentId]);
  const answeredCount = Object.keys(answered).length;
  const total = questions.length;

  if (completedAttempt && !summary) {
    return (
      <SummaryCard
        summary={{
          attempt_id: completedAttempt.id,
          quiz_id: completedAttempt.quiz_id,
          level: 0,
          correct_count: completedAttempt.correct_count,
          incorrect_count: completedAttempt.incorrect_count,
          question_count: completedAttempt.question_count,
          base_points: completedAttempt.base_points,
          bonus_points: completedAttempt.bonus_points,
          total_points: completedAttempt.total_points,
          passed: completedAttempt.passed,
          pass_correct_threshold: passThreshold,
          next_level: null,
        }}
      />
    );
  }

  function submit() {
    if (!current || !selected) return;
    setError(null);
    startTransition(async () => {
      const res = await submitAnswerAction(attemptId, current.id, selected);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFeedback(res.feedback);
      setAnswered((prev) => ({ ...prev, [current.id]: res.feedback.is_correct }));
    });
  }

  function next() {
    if (feedback?.attempt_summary) {
      setSummary(feedback.attempt_summary);
      return;
    }
    const nextQ = questions.find((q) => !(q.id in answered) && q.id !== current?.id);
    setFeedback(null);
    setSelected(null);
    setCurrentId(nextQ?.id ?? null);
  }

  if (summary) return <SummaryCard summary={summary} />;

  if (!current) {
    return (
      <Alert tone="info">
        All questions in this attempt have been answered. <Link href="/quest" className="link">Return to Money Quest</Link> to see your result.
      </Alert>
    );
  }

  const qNumber = questions.findIndex((q) => q.id === current.id) + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-1 flex justify-between text-sm text-slate-600">
          <span>Question {qNumber} of {total}</span>
          <span>{answeredCount} answered</span>
        </div>
        <ProgressBar value={answeredCount} max={total} label="Quiz progress" />
      </div>

      <section className="card" aria-labelledby="question-title">
        <h2 id="question-title" className="text-sm font-semibold uppercase tracking-wide text-brand-700">{current.title}</h2>
        <p className="mt-2 whitespace-pre-line text-lg font-medium text-slate-900">{current.prompt}</p>

        <fieldset className="mt-5" disabled={Boolean(feedback) || pending}>
          <legend className="sr-only">Choose one answer</legend>
          <div className="space-y-2">
            {current.options.map((o) => {
              const isSelected = selected === o.id;
              const isCorrect = feedback?.correct_option_id === o.id;
              const isWrongPick = feedback && isSelected && !feedback.is_correct;
              const tone = feedback
                ? isCorrect
                  ? 'border-emerald-500 bg-emerald-50'
                  : isWrongPick
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-200 bg-white opacity-75'
                : isSelected
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-brand-300';
              return (
                <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 ${tone}`}>
                  <input type="radio" name="option" value={o.id} checked={isSelected} onChange={() => setSelected(o.id)} className="mt-1" />
                  <span><span className="font-bold">{o.option_key}.</span> {o.option_text}</span>
                  {feedback && isCorrect ? <span className="ml-auto text-sm font-semibold text-emerald-800">Correct answer</span> : null}
                  {isWrongPick ? <span className="ml-auto text-sm font-semibold text-red-800">Your answer</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? <div className="mt-4"><Alert tone="error">{error}</Alert></div> : null}

        {!feedback ? (
          <button type="button" className="btn-primary mt-5" onClick={submit} disabled={!selected || pending}>
            {pending ? 'Checking…' : 'Submit answer'}
          </button>
        ) : null}
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} onNext={next} isLast={Boolean(feedback.attempt_summary)} /> : null}
    </div>
  );
}

function FeedbackPanel({ feedback, onNext, isLast }: { feedback: AnswerFeedback; onNext: () => void; isLast: boolean }) {
  const points = feedback.base_points + feedback.bonus_points;
  return (
    <section aria-live="polite" className="space-y-4">
      <div className={`card ${feedback.is_correct ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
        <p className="text-lg font-bold text-slate-900">
          {feedback.is_correct ? `Correct! +${points} points` : 'Not quite — let’s see why.'}
        </p>
        {feedback.is_correct && feedback.bonus_points > 0 ? (
          <p className="text-sm text-emerald-900">Includes a {feedback.bonus_points}-point first-attempt bonus.</p>
        ) : null}
        {feedback.replayed ? <p className="text-sm text-slate-700">This answer was already recorded; your score did not change.</p> : null}
        <p className="mt-2 text-slate-800">{feedback.explanation}</p>
        {feedback.teaching_point ? <p className="mt-2 text-sm font-semibold text-slate-900">Remember: {feedback.teaching_point}</p> : null}
      </div>

      {!feedback.is_correct ? <Remediation feedback={feedback} /> : null}

      <button type="button" className="btn-primary" onClick={onNext}>
        {isLast ? 'See my result' : 'Next question'}
      </button>
    </section>
  );
}

function Remediation({ feedback }: { feedback: AnswerFeedback }) {
  const comic = feedback.comic;
  useEffect(() => {
    if (comic) void markRemediationViewedAction(feedback.answer_id);
  }, [comic, feedback.answer_id]);

  return (
    <div className="space-y-4">
      {comic ? (
        <ComicStrip title={comic.title} takeaway={comic.takeaway} panels={comic.panels} imageUrl={comic.image_url} altText={comic.alt_text} />
      ) : null}
      {feedback.practice_question_id ? <PracticeQuestionBox questionId={feedback.practice_question_id} /> : null}
    </div>
  );
}

export function PracticeQuestionBox({ questionId }: { questionId: string }) {
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const q = await loadPracticeAction(questionId);
      if (q) setQuestion(q);
      else setLoadFailed(true);
    });
  }

  function check() {
    if (!selected) return;
    startTransition(async () => setResult(await checkPracticeAction(questionId, selected)));
  }

  if (!question) {
    return (
      <div className="card">
        <p className="font-semibold text-slate-900">Want to try a similar question?</p>
        <p className="text-sm text-slate-700">Practice questions are not graded and do not change your score.</p>
        {loadFailed ? <p className="mt-2 text-sm text-red-800">The practice question is not available right now.</p> : null}
        <button type="button" className="btn-secondary mt-3" onClick={open} disabled={pending}>{pending ? 'Loading…' : 'Try a practice question'}</button>
      </div>
    );
  }

  const done = result?.ok ? result : null;
  return (
    <div className="card">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Practice (not graded)</p>
      <p className="mt-1 whitespace-pre-line font-medium text-slate-900">{question.prompt}</p>
      <fieldset className="mt-3 space-y-2" disabled={Boolean(done) || pending}>
        <legend className="sr-only">Choose one answer</legend>
        {question.options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2 ${
              done && done.correct_option_id === o.id ? 'border-emerald-500 bg-emerald-50' : selected === o.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200'
            }`}
          >
            <input type="radio" name={`practice-${question.id}`} checked={selected === o.id} onChange={() => setSelected(o.id)} className="mt-1" />
            <span><span className="font-bold">{o.option_key}.</span> {o.option_text}</span>
          </label>
        ))}
      </fieldset>
      {!done ? (
        <button type="button" className="btn-secondary mt-3" onClick={check} disabled={!selected || pending}>Check</button>
      ) : (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${done.is_correct ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'}`}>
          <strong>{done.is_correct ? 'Correct! ' : 'Not this time. '}</strong>{done.explanation}
        </p>
      )}
      {result && !result.ok ? <p className="mt-2 text-sm text-red-800">{result.error}</p> : null}
    </div>
  );
}

function SummaryCard({ summary }: { summary: AttemptSummary }) {
  return (
    <div className="mx-auto max-w-2xl card space-y-4 text-center">
      <h2 className="text-2xl font-bold text-slate-900">{summary.passed ? 'Level passed!' : 'Attempt complete'}</h2>
      <p className="text-4xl font-extrabold tabular-nums text-brand-800">
        {summary.correct_count} / {summary.question_count}
      </p>
      <dl className="mx-auto grid max-w-sm grid-cols-3 gap-2 text-sm">
        <div><dt className="text-slate-600">Base</dt><dd className="font-semibold">{formatPoints(summary.base_points)}</dd></div>
        <div><dt className="text-slate-600">Bonus</dt><dd className="font-semibold">{formatPoints(summary.bonus_points)}</dd></div>
        <div><dt className="text-slate-600">This attempt</dt><dd className="font-semibold">{formatPoints(summary.total_points)}</dd></div>
      </dl>
      {summary.passed ? (
        summary.next_level ? (
          <p className="text-slate-800">You unlocked <strong>Level {summary.next_level.level}: {summary.next_level.title}</strong>.</p>
        ) : summary.level > 0 ? (
          <p className="text-slate-800">You have completed every published level. Great work!</p>
        ) : null
      ) : (
        <p className="text-slate-800">
          You need at least {summary.pass_correct_threshold} correct to pass. Review the explanations and comics, then try again.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/quest" className="btn-primary">Back to Money Quest</Link>
        {summary.incorrect_count > 0 ? <Link href="/quest/mistakes" className="btn-secondary">Review my mistakes</Link> : null}
      </div>
    </div>
  );
}
