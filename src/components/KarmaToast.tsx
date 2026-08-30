// Floating toast notification triggered immediately on task completion.
// Governs: memory-bank/systemPatterns.md (UI/UX patterns).
// Key responsibilities:
//   - Self-transitioning animation (fade + slide-up).
//   - Auto-fade-out after 2 seconds.
//   - Bypasses transitions instantly if prefers-reduced-motion media query is set.
//   - Does not block user pointer interactions below the toast (pointer-events-none).

import { useEffect, useState } from 'react';

interface Props {
  points?: number;
  message?: string;
  onClose: () => void;
}

export function KarmaToast({ points, message, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Detect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // Trigger entry transition shortly after mounting
    const enterTimeout = setTimeout(() => {
      setVisible(true);
    }, 20);

    // Trigger exit transition after 2 seconds
    const exitTimeout = setTimeout(() => {
      if (prefersReducedMotion) {
        // If reduced motion is preferred, immediately unmount without animation
        onClose();
      } else {
        // Start exit fade-out transition
        setVisible(false);
        const cleanupTimeout = setTimeout(() => {
          onClose();
        }, 300); // Matches transition-all duration (300ms)
        return () => clearTimeout(cleanupTimeout);
      }
    }, 2000);

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(exitTimeout);
    };
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-white px-5 py-4 shadow-2xl transition-all duration-300 ease-out transform ${
          visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95 motion-reduce:translate-y-0 motion-reduce:scale-100'
        }`}
      >
        {message ? (
          <>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-200">{message}</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              {/* Custom stylized inline Lotus SVG */}
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12 3C12 3 15 8 12 14C9 8 12 3 12 3Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                />
                <path d="M12 8C14 7 19 8 19 12C19 16 14 18 12 21" />
                <path d="M12 8C10 7 5 8 5 12C5 16 10 18 12 21" />
                <path d="M12 12C15 12 17 13 18 15" />
                <path d="M12 12C9 12 7 13 6 15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Task Completed!</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                You earned{' '}
                <span className="font-semibold text-amber-400">{points}</span>{' '}
                karma points!
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
