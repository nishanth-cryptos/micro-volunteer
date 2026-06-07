// Customer-side rating panel shown after task.status === 'completed'.
// Five-star selector + optional comment (≤ 280 chars). Calls
// submitCustomerRating callable. Idempotent — once submitted the task
// doc gets customerRating set and the panel disappears.

import { useId, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const MAX_COMMENT = 280;

interface Props {
  taskId: string;
  volunteerName: string;
}

export function CustomerRatingPanel({ taskId, volunteerName }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentId = useId();
  const errorId = useId();

  async function handleSubmit() {
    setError(null);
    if (rating === null) {
      setError('Please choose a rating.');
      return;
    }
    setBusy(true);
    try {
      const fn = httpsCallable<
        { taskId: string; rating: number; comment?: string },
        { taskId: string }
      >(functions(), 'submitCustomerRating');
      const payload: { taskId: string; rating: number; comment?: string } = {
        taskId,
        rating,
      };
      if (comment.trim()) payload.comment = comment.trim();
      await fn(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save your rating.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">
        How was {volunteerName}?
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Your rating shapes their trust score and helps future task posters.
      </p>

      <div
        role="radiogroup"
        aria-label="Rate the volunteer from 1 to 5"
        className="mt-6 flex gap-2"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onClick={() => setRating(n)}
            className={
              'flex h-12 w-12 items-center justify-center rounded-full text-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ' +
              (rating !== null && n <= rating
                ? 'bg-amber-400 text-white'
                : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200')
            }
            aria-label={`${String(n)} ${n === 1 ? 'star' : 'stars'}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="mt-6">
        <label
          htmlFor={commentId}
          className="block text-sm font-medium text-neutral-900"
        >
          Comment{' '}
          <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id={commentId}
          rows={2}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="A short note — only admins read this in Phase 1."
          className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-500">
          {comment.length} / {MAX_COMMENT}
        </p>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={busy || rating === null}
        className="mt-6 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit rating'}
      </button>
    </section>
  );
}
