import { useState } from 'react';

interface ScheduleTaskBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scheduledForMs: number) => void;
  isSubmitting?: boolean;
}

export function ScheduleTaskBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: ScheduleTaskBottomSheetProps) {
  const [selectedIso, setSelectedIso] = useState(() => {
    const defaultMs = Date.now() + 60 * 60 * 1000;
    const d = new Date(defaultMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nowMs] = useState(() => Date.now());

  if (!isOpen) return null;

  const minMs = nowMs + 30 * 60 * 1000;
  const maxMs = nowMs + 7 * 24 * 60 * 60 * 1000;



  const toLocalIso = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const minIso = toLocalIso(minMs);
  const maxIso = toLocalIso(maxMs);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pickedDate = new Date(selectedIso);
    const pickedMs = pickedDate.getTime();

    if (isNaN(pickedMs)) {
      setErrorMsg('Please select a valid date and time.');
      return;
    }

    if (pickedMs < minMs) {
      setErrorMsg('Scheduled time must be at least 30 minutes from now.');
      return;
    }

    if (pickedMs > maxMs) {
      setErrorMsg('Scheduled time cannot be more than 7 days in advance.');
      return;
    }

    onConfirm(pickedMs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl transition-all sm:rounded-3xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden" />

        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Pick an estimated time
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              We&apos;ll start reaching out to nearby volunteers at this time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="schedule-datetime"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-600"
            >
              Activation Date & Time
            </label>
            <input
              id="schedule-datetime"
              type="datetime-local"
              min={minIso}
              max={maxIso}
              value={selectedIso}
              onChange={(e) => {
                setSelectedIso(e.target.value);
                setErrorMsg(null);
              }}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 shadow-sm transition focus:border-[#1f6f5c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]/20"
              required
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Min: 30 mins from now · Max: 7 days out
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 focus:outline-none disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#1f6f5c] px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none shadow-md focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Confirm schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
