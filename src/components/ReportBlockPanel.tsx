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
}

export function ReportBlockPanel({
  taskId,
  reportedUserId,
  reportedUserName,
  viewerRole,
}: Props) {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  // Report Form state — values must stay in sync with systemPatterns.md
  // PII inventory / report taxonomy: safety | no_show | inappropriate | fraud | other.
  const [reason, setReason] = useState('safety');
  const [details, setDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  // Set when the Cloud Function rejects with already-exists — neutral copy.
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
        { reportedUserId: string; taskId: string; reason: string; details: string },
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
      // Firebase callable surfaces our HttpsError code as `err.code` on a
      // FirebaseError. Anything tagged 'functions/already-exists' means the
      // duplicate-prevention check fired — show neutral copy instead of a
      // red error.
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === 'functions/already-exists') {
        setReportDuplicate(true);
      } else {
        setReportError(
          err instanceof Error ? err.message : 'Could not submit report. Try again.',
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
        // Redirect to main app home screen after blocking
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

  return (
    <div className="mt-8 rounded-2xl border border-red-100 bg-red-50/30 p-6">
      <h3 className="text-base font-semibold text-neutral-900">Safety & Trust</h3>
      <p className="mt-1 text-sm text-neutral-600">
        If you experience any safety issues, rudeness, or a no-show, please report it.
        {viewerRole === 'customer'
          ? ' You can also block this user to prevent matching again.'
          : ''}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowReportModal(true)}
          className="rounded-full bg-white border border-neutral-300 px-4 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
        >
          Report {reportedUserName}
        </button>
        {viewerRole === 'customer' && (
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className="rounded-full bg-white border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Block {reportedUserName}
          </button>
        )}
      </div>

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <h2 className="text-xl font-semibold text-neutral-900">
              Report User
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Your report will be reviewed by an administrator. The reported user will not know you reported them.
            </p>

            {reportSuccess ? (
              <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-medium">
                Report submitted successfully. Thank you for helping keep our community safe.
              </div>
            ) : reportDuplicate ? (
              <div className="mt-6 rounded-xl bg-neutral-100 border border-neutral-200 p-4 text-neutral-700 text-sm">
                You've already submitted a report for this user on this task.
                Administrators are reviewing it.
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReportModal(false);
                      setReportDuplicate(false);
                    }}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => void handleReportSubmit(e)} className="mt-6">
                <div>
                  <label htmlFor="report-reason" className="block text-sm font-medium text-neutral-700">
                    Reason
                  </label>
                  <select
                    id="report-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="safety">Safety concern</option>
                    <option value="no_show">No show / did not arrive</option>
                    <option value="inappropriate">Inappropriate behavior</option>
                    <option value="fraud">Fraud or scam</option>
                    <option value="other">Other reason</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label htmlFor="report-details" className="block text-sm font-medium text-neutral-700">
                    Details (optional, max 500 characters)
                  </label>
                  <textarea
                    id="report-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Provide additional details about what happened..."
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <div className="mt-1 text-right text-xs text-neutral-500">
                    {details.length}/500
                  </div>
                </div>

                {reportError && (
                  <p role="alert" className="mt-4 text-sm text-red-700 font-medium">
                    {reportError}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    disabled={reportBusy}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportBusy}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <h2 className="text-xl font-semibold text-neutral-900">
              Block {reportedUserName}?
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to block this user? You will no longer be matched with them, and you won't be able to chat with them. This action is mutual and cannot be undone directly.
            </p>

            {blockSuccess ? (
              <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-medium">
                User blocked. Redirecting you home...
              </div>
            ) : (
              <div className="mt-6">
                {blockError && (
                  <p role="alert" className="mb-4 text-sm text-red-700 font-medium">
                    {blockError}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    disabled={blockBusy}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBlockConfirm()}
                    disabled={blockBusy}
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none disabled:opacity-50"
                  >
                    {blockBusy ? 'Blocking…' : 'Confirm Block'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
