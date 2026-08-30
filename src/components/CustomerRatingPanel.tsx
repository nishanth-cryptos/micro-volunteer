// Customer-side rating panel shown after task.status === 'completed'.
// Five-star selector + sentiment feedback + optional quick compliment tags
// + comment (≤ 280 chars). Calls submitCustomerRating callable. Idempotent.

import { useId, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const MAX_COMMENT = 280;

const SENTIMENT_LABELS: Record<number, string> = {
  1: 'Needs improvement',
  2: 'Fair',
  3: 'Good & helpful',
  4: 'Great neighbour',
  5: 'Exceptional help! ★★★★★',
};

const COMPLIMENT_TAGS = [
  'Punctual',
  'Friendly & polite',
  'Super helpful',
  'Great communication',
  'Careful & attentive',
];

interface Props {
  taskId: string;
  volunteerName?: string;
}

export function CustomerRatingPanel({
  taskId,
  volunteerName = 'your volunteer',
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const commentId = useId();
  const errorId = useId();

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (rating === null) {
      setError('Please select a star rating.');
      return;
    }
    setBusy(true);
    try {
      const fn = httpsCallable<
        { taskId: string; rating: number; comment?: string },
        { taskId: string }
      >(functions(), 'submitCustomerRating');

      const tagText =
        selectedTags.length > 0 ? `[${selectedTags.join(', ')}] ` : '';
      const fullComment = `${tagText}${comment.trim()}`.trim();

      const payload: { taskId: string; rating: number; comment?: string } = {
        taskId,
        rating,
      };
      if (fullComment) payload.comment = fullComment.slice(0, MAX_COMMENT);
      await fn(payload);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save your rating.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <section className="vc-fade-up mt-8 rounded-3xl border border-[#e3efe9] bg-white p-7 text-center shadow-xs">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e3efe9] text-[#1f6f5c]">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="mt-3.5 text-base font-bold text-[#131312]">
          Thank you for your feedback!
        </h3>
        <p className="mt-1 text-xs text-[#4f4b46]">
          Your rating builds community trust and recognizes helpful neighbours.
        </p>
      </section>
    );
  }

  const activeDisplayRating = hoveredRating ?? rating;

  return (
    <section className="vc-fade-up mt-8 rounded-3xl border border-[#ececea] bg-white p-7 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fef3c7] text-[#b45309]">
          ★
        </span>
        <div>
          <h2 className="text-base font-bold text-[#131312]">
            How was your experience with {volunteerName}?
          </h2>
          <p className="mt-0.5 text-xs text-[#4f4b46]">
            Your rating recognizes great neighbours and maintains neighbourhood
            trust.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-[#fafaf8] border border-[#ececea] p-5">
        <div
          role="radiogroup"
          aria-label="Rate the volunteer from 1 to 5"
          className="flex items-center gap-2"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const isFilled =
              activeDisplayRating !== null && n <= activeDisplayRating;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                onMouseEnter={() => setHoveredRating(n)}
                onMouseLeave={() => setHoveredRating(null)}
                onClick={() => setRating(n)}
                className={
                  'flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] hover:scale-110 ' +
                  (isFilled
                    ? 'bg-[#fbbf24] text-white shadow-xs'
                    : 'bg-white border border-[#ececea] text-[#b8b3ad] hover:text-[#8a847d]')
                }
                aria-label={`${String(n)} ${n === 1 ? 'star' : 'stars'}`}
              >
                ★
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs font-semibold text-[#131312] min-h-[18px]">
          {activeDisplayRating
            ? SENTIMENT_LABELS[activeDisplayRating]
            : 'Select a rating'}
        </p>
      </div>

      {rating !== null && rating >= 4 && (
        <div className="vc-fade-in mt-5">
          <p className="text-xs font-semibold text-[#131312]">
            What went well? (optional)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMPLIMENT_TAGS.map((tag) => {
              const on = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={
                    'rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
                    (on
                      ? 'bg-[#1f6f5c] text-white shadow-xs'
                      : 'border border-[#ececea] bg-[#fafaf8] text-[#4f4b46] hover:bg-[#f3f1ec]')
                  }
                >
                  {on ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        <label
          htmlFor={commentId}
          className="block text-xs font-semibold text-[#131312]"
        >
          Add a note{' '}
          <span className="font-normal text-[#8a847d]">(optional)</span>
        </label>
        <textarea
          id={commentId}
          rows={2}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share details about what made the help great..."
          className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-sm text-[#131312] placeholder-[#b8b3ad] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-4 focus:ring-[#1f6f5c]/10"
        />
        <p className="mt-1 text-right font-mono text-[11px] text-[#8a847d]">
          {comment.length} / {MAX_COMMENT}
        </p>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy || rating === null}
          className="rounded-full bg-[#1f6f5c] px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] disabled:opacity-50 shadow-sm"
        >
          {busy ? 'Submitting…' : 'Submit rating'}
        </button>
      </div>
    </section>
  );
}
