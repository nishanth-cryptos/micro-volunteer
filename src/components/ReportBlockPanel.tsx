import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { functions } from '../lib/firebase';

interface Props {
  taskId: string;
  reportedUserId: string;
  reportedUserName: string;
  // Role of the user currently viewing this panel. Volunteers do not see
  // the Block button — block remains a customer-only action.
  viewerRole: 'customer' | 'volunteer';
  // 'card' (default) renders the full bordered Safety & Trust panel.
  // 'inline' renders just the action buttons (used in the chat header).
  variant?: 'card' | 'inline';
}

export function ReportBlockPanel({
  taskId,
  reportedUserId,
  reportedUserName,
  viewerRole,
  variant = 'card',
}: Props) {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // Report Form state — taxonomy: safety | no_show | inappropriate | fraud | other
  const [reason, setReason] = useState('safety');
  const [details, setDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportDuplicate, setReportDuplicate] = useState(false);

  // Block state
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockSuccess, setBlockSuccess] = useState(false);

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReportError(null);
    setReportDuplicate(false);
    setReportBusy(true);

    try {
      const fn = httpsCallable<
        {
          reportedUserId: string;
          taskId: string;
          reason: string;
          details: string;
        },
        { reportId: string }
      >(functions(), 'reportUser');

      await fn({
        reportedUserId,
        taskId,
        reason,
        details,
      });

      setReportSuccess(true);
      setDetails('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 3000);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === 'functions/already-exists') {
        setReportDuplicate(true);
      } else {
        setReportError(
          err instanceof Error
            ? err.message
            : 'Could not submit report. Try again.',
        );
      }
    } finally {
      setReportBusy(false);
    }
  }

  async function handleBlockConfirm() {
    setBlockError(null);
    setBlockBusy(true);

    try {
      const fn = httpsCallable<{ blockedUserId: string }, { blockId: string }>(
        functions(),
        'blockUser',
      );

      await fn({ blockedUserId: reportedUserId });

      setBlockSuccess(true);
      setTimeout(() => {
        setShowBlockModal(false);
        setBlockSuccess(false);
        void navigate('/app', { replace: true });
      }, 2000);
    } catch (err) {
      setBlockError(
        err instanceof Error ? err.message : 'Could not block user. Try again.',
      );
    } finally {
      setBlockBusy(false);
    }
  }

  const actions = (
    <div
      className={
        variant === 'inline'
          ? 'flex flex-wrap gap-2'
          : 'mt-4 flex flex-wrap items-center gap-3'
      }
    >
      <button
        type="button"
        onClick={() => setShowReportModal(true)}
        className="rounded-full border border-[#ececea] bg-white px-4 py-1.5 text-xs font-semibold text-[#4f4b46] transition hover:border-[#131312] hover:text-[#131312] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] shadow-2xs"
      >
        🚩 Report {variant === 'inline' ? '' : reportedUserName}
      </button>
      {viewerRole === 'customer' && (
        <button
          type="button"
          onClick={() => setShowBlockModal(true)}
          className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 hover:border-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shadow-2xs"
        >
          🚫 Block {variant === 'inline' ? '' : reportedUserName}
        </button>
      )}
    </div>
  );

  return (
    <>
      {variant === 'card' ? (
        <div className="vc-fade-up mt-8 rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              🛡️
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[#131312]">
                Safety &amp; Community Standards
              </h3>
              <p className="mt-1 text-xs text-[#4f4b46] leading-relaxed">
                If you experience any safety concerns, payment solicitations, or
                no-shows, report it confidentially to our moderation team.
                {viewerRole === 'customer'
                  ? ' You can also block this neighbour to permanently prevent future matching.'
                  : ''}
              </p>
              {actions}
            </div>
          </div>
        </div>
      ) : (
        actions
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => !reportBusy && setShowReportModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-labelledby="report-modal-title"
            className="vc-fade-up relative z-10 w-full max-w-md rounded-3xl border border-[#ececea] bg-white p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="report-modal-title"
                  className="text-lg font-bold text-[#131312]"
                >
                  Report {reportedUserName}
                </h2>
                <p className="mt-1 text-xs text-[#4f4b46]">
                  Submitted confidentially to our safety team. The reported user
                  will not know you reported them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                disabled={reportBusy}
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition disabled:opacity-50"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {reportSuccess ? (
              <div className="mt-6 rounded-2xl bg-[#e3efe9] border border-[#1f6f5c]/20 p-4 text-[#1f6f5c] text-xs font-semibold">
                ✓ Report submitted. Our safety team investigates all reported
                incidents confidentially. Thank you for keeping the
                neighbourhood safe.
              </div>
            ) : reportDuplicate ? (
              <div className="mt-6 rounded-2xl bg-[#fafaf8] border border-[#ececea] p-4 text-[#4f4b46] text-xs">
                You have already submitted a report for this user on this task.
                Our moderation team is actively reviewing it.
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReportModal(false);
                      setReportDuplicate(false);
                    }}
                    className="rounded-full bg-[#1f6f5c] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#185845]"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleReportSubmit(e)}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="report-reason"
                    className="block text-xs font-bold text-[#131312]"
                  >
                    Reason for report
                  </label>
                  <select
                    id="report-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1.5 block w-full rounded-2xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-xs font-medium text-[#131312] shadow-xs focus:border-[#1f6f5c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]/20"
                  >
                    <option value="safety">
                      Safety concern or feeling unsafe
                    </option>
                    <option value="no_show">
                      No show / did not arrive at meeting point
                    </option>
                    <option value="inappropriate">
                      Inappropriate or abusive behavior
                    </option>
                    <option value="fraud">
                      Commercial service / fee solicitation attempt
                    </option>
                    <option value="other">Other policy violation</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="report-details"
                    className="block text-xs font-bold text-[#131312]"
                  >
                    Incident details (optional)
                  </label>
                  <textarea
                    id="report-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Briefly describe what happened..."
                    className="mt-1.5 block w-full rounded-2xl border border-[#ececea] bg-[#fafaf8] p-3 text-xs text-[#131312] shadow-xs placeholder-[#8a847d] focus:border-[#1f6f5c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f5c]/20"
                  />
                  <div className="mt-1 text-right text-[11px] text-[#8a847d]">
                    {details.length}/500
                  </div>
                </div>

                {reportError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium"
                  >
                    {reportError}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    disabled={reportBusy}
                    className="rounded-full border border-[#ececea] px-4 py-2 text-xs font-semibold text-[#4f4b46] transition hover:bg-[#fafaf8] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportBusy}
                    className="rounded-full bg-[#1f6f5c] px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#185845] focus:outline-none disabled:opacity-50"
                  >
                    {reportBusy ? 'Submitting…' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* BLOCK MODAL */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => !blockBusy && setShowBlockModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-labelledby="block-modal-title"
            className="vc-fade-up relative z-10 w-full max-w-md rounded-3xl border border-[#ececea] bg-white p-7 shadow-2xl"
          >
            <h2
              id="block-modal-title"
              className="text-lg font-bold text-[#131312]"
            >
              Block {reportedUserName}?
            </h2>
            <div className="mt-3 space-y-2 text-xs text-[#4f4b46] leading-relaxed">
              <p>
                Blocking is <strong>immediate and mutual</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  You will never be matched with this neighbour again on future
                  tasks.
                </li>
                <li>Direct chat communication is immediately disabled.</li>
                <li>
                  You can manage your blocked users anytime in your Profile.
                </li>
              </ul>
            </div>

            {blockSuccess ? (
              <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-xs font-semibold">
                User blocked successfully. Returning home...
              </div>
            ) : (
              <div className="mt-6">
                {blockError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium"
                  >
                    {blockError}
                  </p>
                )}

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    disabled={blockBusy}
                    className="rounded-full border border-[#ececea] px-4 py-2 text-xs font-semibold text-[#4f4b46] transition hover:bg-[#fafaf8] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBlockConfirm()}
                    disabled={blockBusy}
                    className="rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 focus:outline-none disabled:opacity-50"
                  >
                    {blockBusy ? 'Blocking…' : 'Confirm Block'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
