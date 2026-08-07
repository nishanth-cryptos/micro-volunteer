// Rebranded Departure Prompt Modal — Prompts volunteer on departure signal
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { type CanonicalRoute, type TaskSuggestion } from '../lib/trail-service/types';

interface Props {
  isOpen: boolean;
  route: CanonicalRoute;
  suggestions: TaskSuggestion[];
  slackMinutes: number;
  onConfirm: (suggestionId?: string) => void;
  onDecline: () => void;
}

export function DeparturePromptModal({
  isOpen,
  route,
  suggestions,
  slackMinutes,
  onConfirm,
  onDecline,
}: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (!isOpen) return null;

  const daysText = route.dayOfWeekMask
    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
    .join(', ');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#131312]/60 p-4 backdrop-blur-xs vc-fade-up">
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[#ececea] bg-white p-6 shadow-xl sm:p-7">
        {/* Brand emblem header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f5c]">
              Hey Padosi • Commute Match
            </span>
            <h2 className="m-0 text-xl font-bold tracking-tight text-[#131312]">
              Heading out on your usual route?
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#4f4b46]">
          You look ready to head towards{' '}
          <strong className="font-semibold text-[#131312]">
            {route.destinationLabel}
          </strong>{' '}
          ({daysText}).
        </p>

        {/* Time Budget & Slack Pill */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fafaf8] border border-[#ececea] p-3.5">
          <div>
            <div className="text-xs font-semibold text-[#8a847d] uppercase tracking-wider">
              Predicted Duration
            </div>
            <div className="text-sm font-bold text-[#131312]">
              ~{route.durationMeanMinutes} mins
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-[#8a847d] uppercase tracking-wider">
              Available Slack Window
            </div>
            <div className="inline-flex items-center gap-1 text-sm font-bold text-[#1f6f5c]">
              <span className="h-2 w-2 rounded-full bg-[#1f6f5c] animate-pulse" />
              {slackMinutes} mins spare
            </div>
          </div>
        </div>

        {/* Task Suggestions */}
        {suggestions.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#8a847d]">
              Tasks that fit your trip ({suggestions.length})
            </div>
            <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
              {suggestions.map((sug) => {
                const isSelected = selectedTaskId === sug.taskId;
                const detourMin = Math.ceil(sug.addedDetourSeconds / 60);
                return (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => setSelectedTaskId(isSelected ? null : sug.taskId)}
                    className={
                      'w-full text-left rounded-xl p-3.5 transition border text-sm flex items-center justify-between ' +
                      (isSelected
                        ? 'bg-[#e3efe9]/50 border-[#1f6f5c] ring-2 ring-[#1f6f5c]'
                        : 'bg-white border-[#ececea] hover:border-[#1f6f5c]/50')
                    }
                  >
                    <div>
                      <div className="font-bold text-[#131312]">{sug.title}</div>
                      <div className="mt-0.5 text-xs text-[#8a847d]">
                        Category: {sug.category}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="rounded-full bg-[#e3efe9] px-2.5 py-1 text-xs font-bold text-[#1f6f5c]">
                        +{detourMin} min detour
                      </span>
                      <div className="mt-1 text-[11px] font-medium text-[#4f4b46]">
                        Fits your {slackMinutes} min window
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#ececea] bg-[#fafaf8] p-4 text-center text-xs text-[#8a847d]">
            No matching tasks along your corridor right now. We&apos;ll notify you if a neighbour posts one!
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-xl border border-[#ececea] px-5 py-2.5 text-sm font-semibold text-[#4f4b46] transition hover:bg-[#fafaf8] hover:text-[#131312]"
          >
            Not heading out
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedTaskId ?? undefined)}
            className="rounded-xl bg-[#1f6f5c] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#185845]"
          >
            {selectedTaskId ? 'Accept task & start' : 'Yes, heading out'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
