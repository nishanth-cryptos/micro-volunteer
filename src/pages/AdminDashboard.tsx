import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import { db, functions } from '../lib/firebase';
import { Logo } from '../components/Logo';

const REASON_MIN_LENGTH = 10;
const AUTO_DISMISS_MS = 3500;
const ACTIVITY_LOG_PAGE_SIZE = 50;

interface ReportDoc {
  id: string;
  reporterUid: string;
  reportedUid: string;
  taskId: string;
  reason: string;
  details: string;
  status: 'pending' | 'actioned' | 'dismissed';
  uniqueReporterCount?: number;
  createdAt: Timestamp;
}

interface UserSummary {
  uid: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  email?: string;
  accountStatus?: string;
  trustScore?: number;
  verifiedTaskCount?: number;
  verifiedHours?: number;
  pendingReports?: number;
  reportPenalty?: number;
  warningsCount?: number;
  suspendedUntil?: Timestamp;
}

interface AuditEvent {
  id: string;
  type: string;
  actorUid: string;
  at: Timestamp;
  payload?: Record<string, unknown>;
}

interface ModerationLogEntry {
  id: string;
  action: string;
  reason: string;
  adminId: string;
  timestamp: Timestamp;
}

type AdminTab = 'reports' | 'users' | 'tasks' | 'activity';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    completedTasks: 0,
    openReports: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Load stats
  useEffect(() => {
    const usersQ = query(collection(db(), 'users'));
    const completedTasksQ = query(
      collection(db(), 'tasks'),
      where('status', '==', 'completed'),
    );
    const openReportsQ = query(
      collection(db(), 'reports'),
      where('status', '==', 'pending'),
    );

    let unsubUsers = () => {};
    let unsubTasks = () => {};
    let unsubReports = () => {};

    try {
      unsubUsers = onSnapshot(usersQ, (snap) => {
        setStats((prev) => ({ ...prev, totalUsers: snap.size }));
      });
      unsubTasks = onSnapshot(completedTasksQ, (snap) => {
        setStats((prev) => ({ ...prev, completedTasks: snap.size }));
      });
      unsubReports = onSnapshot(openReportsQ, (snap) => {
        setStats((prev) => ({ ...prev, openReports: snap.size }));
        setStatsLoading(false);
      });
    } catch (err) {
      console.error('Error fetching admin stats:', err);
      setTimeout(() => setStatsLoading(false), 0);
    }

    return () => {
      unsubUsers();
      unsubTasks();
      unsubReports();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#ececea] bg-white px-6 py-4 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Logo size="md" />
            <span className="hidden sm:inline-block text-[#ececea] font-light">
              |
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-xs font-bold text-[#1f6f5c]">
                🛡️ Safety &amp; Moderation
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ececea] bg-[#fafaf8] px-4 py-2 text-xs font-semibold text-[#4f4b46] transition hover:bg-[#ececea] hover:text-[#131312] focus:outline-none"
            >
              <span>←</span> Return to App Home
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        {/* Action-First Triage Overview Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Urgent Safety Reports Card */}
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={
              'text-left w-full cursor-pointer rounded-3xl border p-6 transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
              (stats.openReports > 0
                ? 'border-amber-300 bg-[#fffbeb] hover:border-amber-400'
                : 'border-[#ececea] bg-white hover:border-[#1f6f5c]/40')
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                Safety Reports Queue
              </span>
              {stats.openReports > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                  <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
                  Review Needed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  ✓ All Clear
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-[#131312]">
                {statsLoading ? '…' : stats.openReports}
              </span>
              <span className="text-xs text-[#4f4b46]">
                {stats.openReports === 1 ? 'pending report' : 'pending reports'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#8a847d]">
              {stats.openReports > 0
                ? 'Neighbour safety reports awaiting administrative review.'
                : 'Zero open safety flags in queue.'}
            </p>
          </button>

          {/* Operations: Completed Missions */}
          <div className="rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                Completed Tasks
              </span>
              <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-[11px] font-bold text-[#1f6f5c]">
                Verified
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-[#1f6f5c]">
                {statsLoading ? '…' : stats.completedTasks}
              </span>
              <span className="text-xs text-[#4f4b46]">missions completed</span>
            </div>
            <p className="mt-2 text-xs text-[#8a847d]">
              Hyperlocal community tasks safely finished and verified.
            </p>
          </div>

          {/* Platform Community Size */}
          <div className="rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                Community Directory
              </span>
              <span className="rounded-full bg-[#f3f1ec] px-2.5 py-0.5 text-[11px] font-bold text-[#4f4b46]">
                Registered
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-[#131312]">
                {statsLoading ? '…' : stats.totalUsers}
              </span>
              <span className="text-xs text-[#4f4b46]">members</span>
            </div>
            <p className="mt-2 text-xs text-[#8a847d]">
              Verified requesters and volunteers in neighbourhood network.
            </p>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-[#ececea] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
              (activeTab === 'reports'
                ? 'bg-[#131312] text-white shadow-xs'
                : 'bg-white border border-[#ececea] text-[#4f4b46] hover:bg-[#fafaf8]')
            }
          >
            <span>Pending Reports</span>
            {stats.openReports > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {stats.openReports}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
              (activeTab === 'users'
                ? 'bg-[#131312] text-white shadow-xs'
                : 'bg-white border border-[#ececea] text-[#4f4b46] hover:bg-[#fafaf8]')
            }
          >
            <span>User Safety Lookup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
              (activeTab === 'tasks'
                ? 'bg-[#131312] text-white shadow-xs'
                : 'bg-white border border-[#ececea] text-[#4f4b46] hover:bg-[#fafaf8]')
            }
          >
            <span>Task Lifecycle Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] ' +
              (activeTab === 'activity'
                ? 'bg-[#131312] text-white shadow-xs'
                : 'bg-white border border-[#ececea] text-[#4f4b46] hover:bg-[#fafaf8]')
            }
          >
            <span>Activity &amp; Audit Stream</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="mt-6">
          {activeTab === 'reports' && <PendingReportsPanel />}
          {activeTab === 'users' && <UserLookupPanel />}
          {activeTab === 'tasks' && <TaskAuditPanel />}
          {activeTab === 'activity' && <ActivityLogPanel />}
        </div>
      </div>
    </main>
  );
}

/* ============================================================================
   PENDING REPORTS PANEL
   ============================================================================ */
function PendingReportsPanel() {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userNames, setUserNames] = useState<Record<string, string | null>>({});
  const [taskMap, setTaskMap] = useState<
    Record<string, { customerId: string; acceptedVolunteerId?: string }>
  >({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Moderation modal state
  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [modAction, setModAction] = useState<
    'warn' | 'suspend' | 'ban' | 'dismiss'
  >('warn');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState(3);

  // Auto-dismiss banners
  useEffect(() => {
    if (!actionSuccess) return;
    const id = setTimeout(() => setActionSuccess(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [actionSuccess]);
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [error]);

  useEffect(() => {
    const q = query(
      collection(db(), 'reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setReports(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ReportDoc, 'id'>),
          })),
        );
        setLoading(false);
      },
      (err) => {
        setError('Error loading reports: ' + err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  // Resolve user display names
  useEffect(() => {
    let cancelled = false;
    const uids = new Set<string>();
    for (const r of reports) {
      uids.add(r.reporterUid);
      uids.add(r.reportedUid);
      const t = taskMap[r.taskId];
      if (t) {
        uids.add(t.customerId);
        if (t.acceptedVolunteerId) uids.add(t.acceptedVolunteerId);
      }
    }
    const unresolved = [...uids].filter((u) => !(u in userNames));
    if (unresolved.length === 0) return;
    void Promise.all(
      unresolved.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db(), 'users', uid));
          const data = snap.exists()
            ? (snap.data() as { displayName?: string })
            : null;
          return [uid, data?.displayName ?? null] as const;
        } catch {
          return [uid, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setUserNames((prev) => {
        const next = { ...prev };
        for (const [uid, name] of results) {
          next[uid] = name;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [reports, userNames, taskMap]);

  // Resolve tasks
  useEffect(() => {
    let cancelled = false;
    const taskIds = new Set(reports.map((r) => r.taskId));
    const unresolved = [...taskIds].filter((t) => !(t in taskMap));
    if (unresolved.length === 0) return;
    void Promise.all(
      unresolved.map(async (taskId) => {
        try {
          const snap = await getDoc(doc(db(), 'tasks', taskId));
          if (!snap.exists()) return null;
          const data = snap.data() as {
            customerId: string;
            acceptedVolunteerId?: string;
          };
          return [taskId, data] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setTaskMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (!r) continue;
          const [taskId, data] = r;
          next[taskId] = data.acceptedVolunteerId
            ? {
                customerId: data.customerId,
                acceptedVolunteerId: data.acceptedVolunteerId,
              }
            : { customerId: data.customerId };
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [reports, taskMap]);

  function reporterRole(report: ReportDoc): string {
    const t = taskMap[report.taskId];
    if (!t) return 'Reporter';
    if (t.customerId === report.reporterUid) return 'Customer';
    if (t.acceptedVolunteerId === report.reporterUid) return 'Volunteer';
    return 'Reporter';
  }

  async function handleModerationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReport) return;
    if (reason.trim().length < REASON_MIN_LENGTH) return;

    setError(null);
    setBusyReportId(selectedReport.id);

    try {
      const fn = httpsCallable<
        {
          userId: string;
          action: string;
          reason: string;
          durationDays?: number;
          reportId?: string;
        },
        { success: boolean }
      >(functions(), 'applyModerationAction');

      const params: {
        userId: string;
        action: string;
        reason: string;
        durationDays?: number;
        reportId?: string;
      } = {
        userId: selectedReport.reportedUid,
        action: modAction,
        reason,
        reportId: selectedReport.id,
      };

      if (modAction === 'suspend') {
        params.durationDays = durationDays;
      }

      await fn(params);

      setActionSuccess(`Successfully applied ${modAction} to user account.`);
      setSelectedReport(null);
      setReason('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not apply moderation action.',
      );
    } finally {
      setBusyReportId(null);
    }
  }

  return (
    <div className="space-y-4">
      {actionSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 vc-fade-up">
          {actionSuccess}
        </div>
      )}

      {error && !selectedReport && (
        <div className="rounded-2xl border border-red-200 bg-[#fdf0ef] p-4 text-sm font-semibold text-[#a32a22]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-3xl border border-[#ececea] bg-white p-6 space-y-3"
            >
              <div className="h-4 w-1/4 rounded bg-[#ececea]" />
              <div className="h-3 w-1/2 rounded bg-[#ececea]" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#ececea] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e3efe9] text-[#1f6f5c]">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-bold text-[#131312]">
            No reports need your attention
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#8a847d]">
            Everything is clear. All submitted reports have been reviewed and
            resolved.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const expanded = expandedId === report.id;
            const role = reporterRole(report);
            const reportedName = userNames[report.reportedUid] ?? '…';
            const reporterName = userNames[report.reporterUid] ?? '…';
            return (
              <div
                key={report.id}
                className="vc-fade-up overflow-hidden rounded-3xl border border-[#ececea] bg-white shadow-xs transition hover:border-[#d8d4cc]"
              >
                {/* Header */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[#fafaf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f3f1ec] px-2.5 py-0.5 text-[11px] font-bold text-[#4f4b46]">
                        {role} · {reporterName}
                      </span>
                      <span className="text-xs text-[#8a847d]">reported</span>
                      <span className="font-bold text-sm text-[#131312] truncate">
                        {reportedName}
                      </span>
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                        {report.reason.replace(/_/g, ' ')}
                      </span>
                      {(report.uniqueReporterCount ?? 1) > 1 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          {report.uniqueReporterCount} unique reporters
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[#8a847d]">
                      Reported {report.createdAt.toDate().toLocaleString()}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className={
                      'flex-shrink-0 text-sm font-bold text-[#8a847d] transition ' +
                      (expanded ? 'rotate-180 text-[#131312]' : '')
                    }
                  >
                    ▼
                  </span>
                </button>

                {/* Expanded Details */}
                {expanded &&
                  (() => {
                    const t = taskMap[report.taskId];
                    const customerName = t
                      ? (userNames[t.customerId] ?? '…')
                      : undefined;
                    const volunteerUid = t?.acceptedVolunteerId;
                    const volunteerName = volunteerUid
                      ? (userNames[volunteerUid] ?? '…')
                      : undefined;
                    return (
                      <div className="border-t border-[#f3f1ec] bg-[#fafaf8]/50 p-6 space-y-4">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                            Incident Description
                          </div>
                          <p className="mt-1 rounded-2xl border border-[#ececea] bg-white p-4 text-xs leading-relaxed text-[#131312]">
                            {report.details ||
                              'No additional details provided in report.'}
                          </p>
                        </div>

                        {/* Task & Involved Parties Grid */}
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#ececea] bg-white p-4 text-xs sm:grid-cols-2">
                          {t && (
                            <div>
                              <span className="text-[#8a847d]">Customer: </span>
                              <span className="font-semibold text-[#131312]">
                                {customerName}
                              </span>
                            </div>
                          )}
                          {volunteerUid && (
                            <div>
                              <span className="text-[#8a847d]">
                                Volunteer:{' '}
                              </span>
                              <span className="font-semibold text-[#131312]">
                                {volunteerName}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-[#8a847d]">
                              Task Reference:{' '}
                            </span>
                            <Link
                              to={`/tasks/${report.taskId}`}
                              className="font-semibold text-[#1f6f5c] underline underline-offset-2 hover:text-[#185845]"
                            >
                              Open Task {report.taskId} →
                            </Link>
                          </div>
                          <div>
                            <span className="text-[#8a847d]">Report ID: </span>
                            <span className="font-mono text-[#4f4b46]">
                              {report.id}
                            </span>
                          </div>
                        </div>

                        {/* Action Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <span className="text-xs font-bold text-[#4f4b46] mr-1">
                            Moderation Action:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReport(report);
                              setModAction('warn');
                              setReason('');
                            }}
                            className="rounded-full bg-[#131312] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 transition focus:outline-none"
                          >
                            Issue Warning
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReport(report);
                              setModAction('suspend');
                              setReason('');
                            }}
                            className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition focus:outline-none"
                          >
                            Suspend Account
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReport(report);
                              setModAction('ban');
                              setReason('');
                            }}
                            className="rounded-full bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-800 transition focus:outline-none"
                          >
                            Permanent Ban
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReport(report);
                              setModAction('dismiss');
                              setReason(
                                'Reviewed and dismissed without penalty.',
                              );
                            }}
                            className="rounded-full border border-[#ececea] bg-white px-4 py-2 text-xs font-semibold text-[#4f4b46] hover:bg-[#ececea] transition focus:outline-none"
                          >
                            Dismiss Report
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      )}

      {/* CONSEQUENCE-CLEAR MODERATION MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="vc-fade-up w-full max-w-lg overflow-hidden rounded-3xl border border-[#ececea] bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8a847d]">
                  Moderation Commitment
                </span>
                <h2 className="text-xl font-bold tracking-tight text-[#131312] mt-0.5">
                  {modAction === 'warn'
                    ? 'Issue Formal Warning'
                    : modAction === 'suspend'
                      ? 'Apply Temporary Suspension'
                      : modAction === 'ban'
                        ? 'Permanently Ban Account'
                        : 'Dismiss Safety Report'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                disabled={busyReportId !== null}
                className="rounded-full p-2 text-[#8a847d] hover:bg-[#fafaf8] transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-[#fafaf8] border border-[#ececea] p-3 text-xs text-[#4f4b46]">
              Target User:{' '}
              <strong className="text-[#131312] font-bold">
                {userNames[selectedReport.reportedUid] ?? 'User'}
              </strong>{' '}
              <span className="font-mono text-[#8a847d]">
                ({selectedReport.reportedUid})
              </span>
            </div>

            <form
              onSubmit={(e) => void handleModerationSubmit(e)}
              className="mt-5 space-y-4"
            >
              {modAction === 'suspend' && (
                <div>
                  <label
                    htmlFor="modal-duration"
                    className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                  >
                    Suspension Duration
                  </label>
                  <select
                    id="modal-duration"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-sm font-semibold text-[#131312] focus:border-[#1f6f5c] focus:bg-white focus:outline-none"
                  >
                    <option value={1}>1 Day (24 hours)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (1 week)</option>
                    <option value={30}>30 Days (1 month)</option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="modal-reason"
                  className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                >
                  Administrative Reason (Stored in permanent audit log)
                </label>
                <textarea
                  id="modal-reason"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the clear, policy-based reason for this moderation action..."
                  className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-4 py-3 text-xs text-[#131312] placeholder-[#8a847d] focus:border-[#1f6f5c] focus:bg-white focus:outline-none"
                />
                {reason.length > 0 &&
                  reason.trim().length < REASON_MIN_LENGTH && (
                    <p className="mt-1 text-xs text-red-700">
                      Reason must be at least {REASON_MIN_LENGTH} characters.
                    </p>
                  )}
              </div>

              {/* Consequence Callout Box */}
              <div
                className={
                  'rounded-2xl p-3.5 text-xs leading-relaxed ' +
                  (modAction === 'ban'
                    ? 'border border-red-200 bg-red-50 text-red-900'
                    : modAction === 'suspend'
                      ? 'border border-amber-200 bg-amber-50 text-amber-900'
                      : modAction === 'warn'
                        ? 'border border-neutral-200 bg-[#f3f1ec] text-[#131312]'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-900')
                }
              >
                <span className="font-bold">Consequence: </span>
                {modAction === 'warn' &&
                  'Issues an official warning notice and records +1 warning in the user’s permanent moderation record.'}
                {modAction === 'suspend' &&
                  `Suspends the user for ${durationDays} days. Prevents all volunteering and task creation during this period.`}
                {modAction === 'ban' &&
                  'Irreversible. Permanently disables account access and removes the user from neighbourhood matching.'}
                {modAction === 'dismiss' &&
                  'Closes the report and marks it resolved with no disciplinary penalties applied.'}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                >
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  disabled={busyReportId !== null}
                  className="rounded-full border border-[#ececea] bg-white px-5 py-2.5 text-xs font-semibold text-[#4f4b46] hover:bg-[#fafaf8] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busyReportId !== null ||
                    reason.trim().length < REASON_MIN_LENGTH
                  }
                  className={
                    'rounded-full px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 ' +
                    (modAction === 'ban'
                      ? 'bg-red-700 hover:bg-red-800'
                      : modAction === 'suspend'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-[#131312] hover:bg-neutral-800')
                  }
                >
                  {busyReportId !== null
                    ? 'Applying…'
                    : modAction === 'ban'
                      ? 'Confirm Permanent Ban'
                      : modAction === 'suspend'
                        ? `Confirm ${durationDays}-Day Suspension`
                        : modAction === 'warn'
                          ? 'Confirm Warning'
                          : 'Confirm Dismissal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   USER SAFETY LOOKUP PANEL
   ============================================================================ */
function UserLookupPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [modLogs, setModLogs] = useState<ModerationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moderation modal state
  const [modAction, setModAction] = useState<
    'warn' | 'suspend' | 'ban' | 'dismiss'
  >('warn');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reactivation dialog modal state
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [reactivateReason, setReactivateReason] = useState(
    'Account reinstated by administrator.',
  );
  const [revoking, setRevoking] = useState(false);

  const [adminNames, setAdminNames] = useState<Record<string, string | null>>(
    {},
  );

  useEffect(() => {
    if (!actionSuccess) return;
    const id = setTimeout(() => setActionSuccess(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [actionSuccess]);
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    const uids = new Set(modLogs.map((l) => l.adminId).filter(Boolean));
    const unresolved = [...uids].filter((u) => !(u in adminNames));
    if (unresolved.length === 0) return;
    void Promise.all(
      unresolved.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db(), 'users', uid));
          const data = snap.exists()
            ? (snap.data() as { displayName?: string })
            : null;
          return [uid, data?.displayName ?? null] as const;
        } catch {
          return [uid, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setAdminNames((prev) => {
        const next = { ...prev };
        for (const [uid, name] of results) {
          next[uid] = name;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [modLogs, adminNames]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length === 0) return;

    setError(null);
    setUser(null);
    setModLogs([]);
    setLoading(true);

    try {
      const uid = searchQuery.trim();
      const userRef = doc(db(), 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setUser({
          uid: userSnap.id,
          ...(userSnap.data() as Omit<UserSummary, 'uid'>),
        });
        const logsQ = query(
          collection(db(), 'users', uid, 'moderationLog'),
          orderBy('timestamp', 'desc'),
        );
        const logsSnap = await getDocs(logsQ);
        setModLogs(
          logsSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ModerationLogEntry, 'id'>),
          })),
        );
      } else {
        const nameQ = query(
          collection(db(), 'users'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
        );
        const nameSnap = await getDocs(nameQ);
        if (!nameSnap.empty) {
          const firstDoc = nameSnap.docs[0];
          if (firstDoc) {
            setUser({
              uid: firstDoc.id,
              ...(firstDoc.data() as Omit<UserSummary, 'uid'>),
            });
            const logsQ = query(
              collection(db(), 'users', firstDoc.id, 'moderationLog'),
              orderBy('timestamp', 'desc'),
            );
            const logsSnap = await getDocs(logsQ);
            setModLogs(
              logsSnap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ModerationLogEntry, 'id'>),
              })),
            );
          }
        } else {
          setError('No user found matching that UID or display name.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error searching user.');
    } finally {
      setLoading(false);
    }
  }

  async function handleModerationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (reason.trim().length < REASON_MIN_LENGTH) return;

    setError(null);
    setBusy(true);

    try {
      const fn = httpsCallable<
        {
          userId: string;
          action: string;
          reason: string;
          durationDays?: number;
        },
        { success: boolean }
      >(functions(), 'applyModerationAction');

      const params: {
        userId: string;
        action: string;
        reason: string;
        durationDays?: number;
      } = {
        userId: user.uid,
        action: modAction,
        reason,
      };

      if (modAction === 'suspend') {
        params.durationDays = durationDays;
      }

      await fn(params);

      setActionSuccess(`Successfully applied ${modAction} to user account.`);
      setReason('');

      // Reload user
      const userSnap = await getDoc(doc(db(), 'users', user.uid));
      if (userSnap.exists()) {
        setUser({
          uid: userSnap.id,
          ...(userSnap.data() as Omit<UserSummary, 'uid'>),
        });
      }
      const logsQ = query(
        collection(db(), 'users', user.uid, 'moderationLog'),
        orderBy('timestamp', 'desc'),
      );
      const logsSnap = await getDocs(logsQ);
      setModLogs(
        logsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ModerationLogEntry, 'id'>),
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not apply moderation action.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivateCommit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || reactivateReason.trim().length < REASON_MIN_LENGTH) return;

    setError(null);
    setRevoking(true);
    try {
      const fn = httpsCallable<
        {
          userId: string;
          action: string;
          reason: string;
        },
        { success: boolean }
      >(functions(), 'applyModerationAction');

      await fn({
        userId: user.uid,
        action: 'dismiss',
        reason: reactivateReason.trim(),
      });

      setActionSuccess('Successfully reinstated user account.');
      setReactivateModalOpen(false);

      const userSnap = await getDoc(doc(db(), 'users', user.uid));
      if (userSnap.exists()) {
        setUser({
          uid: userSnap.id,
          ...(userSnap.data() as Omit<UserSummary, 'uid'>),
        });
      }
      const logsQ = query(
        collection(db(), 'users', user.uid, 'moderationLog'),
        orderBy('timestamp', 'desc'),
      );
      const logsSnap = await getDocs(logsQ);
      setModLogs(
        logsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ModerationLogEntry, 'id'>),
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not reactivate account.',
      );
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form
        onSubmit={(e) => void handleSearch(e)}
        className="flex max-w-xl gap-2.5"
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by User UID or display name..."
          required
          className="w-full rounded-2xl border border-[#ececea] bg-white px-4 py-3 text-xs text-[#131312] placeholder-[#8a847d] focus:border-[#1f6f5c] focus:outline-none shadow-xs"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#131312] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition disabled:opacity-50 flex-shrink-0"
        >
          {loading ? 'Searching…' : 'Search User'}
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-[#fdf0ef] p-4 text-xs font-semibold text-[#a32a22]">
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 vc-fade-up">
          {actionSuccess}
        </div>
      )}

      {user && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 vc-fade-up">
          {/* Main User Profile & History (2 cols) */}
          <div className="space-y-6 md:col-span-2">
            {/* Identity & Status */}
            <section className="rounded-3xl border border-[#ececea] bg-white p-7 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-2xl font-bold text-[#5a2900]">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-[#131312]">
                      {user.displayName ?? 'Unnamed User'}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-[#8a847d]">
                      {user.uid}
                    </p>
                    <p className="mt-1 text-xs text-[#4f4b46]">
                      {user.phoneNumber || 'No phone'}{' '}
                      {user.email ? `· ${user.email}` : ''}
                    </p>
                  </div>
                </div>

                <div>
                  <span
                    className={
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ' +
                      (user.accountStatus === 'banned'
                        ? 'bg-red-100 text-red-900'
                        : user.accountStatus === 'suspended'
                          ? 'bg-amber-100 text-amber-900'
                          : user.accountStatus === 'warned'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-900')
                    }
                  >
                    Status: {user.accountStatus?.toUpperCase() ?? 'ACTIVE'}
                  </span>
                </div>
              </div>

              {user.accountStatus && user.accountStatus !== 'active' && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#fafaf8] border border-[#ececea] p-4 text-xs">
                  <div>
                    <span className="font-bold text-[#131312]">
                      Account is restricted.
                    </span>{' '}
                    {user.suspendedUntil && (
                      <span className="text-[#8a847d]">
                        Suspended until{' '}
                        {user.suspendedUntil.toDate().toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReactivateModalOpen(true)}
                    className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                  >
                    Reactivate Account
                  </button>
                </div>
              )}

              {/* Safety & Performance Metrics */}
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#f3f1ec] pt-5 sm:grid-cols-4 text-center">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                    Trust Score
                  </span>
                  <div className="mt-1 font-mono text-xl font-bold text-[#131312]">
                    {user.trustScore ?? 30}/100
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                    Completed Tasks
                  </span>
                  <div className="mt-1 font-mono text-xl font-bold text-[#1f6f5c]">
                    {user.verifiedTaskCount ?? 0}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                    Pending Reports
                  </span>
                  <div className="mt-1 font-mono text-xl font-bold text-amber-700">
                    {user.pendingReports ?? 0}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a847d]">
                    Penalty Score
                  </span>
                  <div className="mt-1 font-mono text-xl font-bold text-red-700">
                    {user.reportPenalty ?? 0}
                  </div>
                </div>
              </div>
            </section>

            {/* Permanent Moderation Log */}
            <section className="rounded-3xl border border-[#ececea] bg-white p-7 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#131312]">
                  Permanent Moderation History
                </h3>
                <span className="font-mono text-xs text-[#8a847d]">
                  {modLogs.length} events
                </span>
              </div>

              {modLogs.length === 0 ? (
                <p className="mt-4 text-xs text-[#8a847d]">
                  No prior moderation actions or penalties recorded for this
                  user.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[#f3f1ec]">
                  {modLogs.map((log) => (
                    <li key={log.id} className="py-3.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            'rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ' +
                            (log.action === 'ban'
                              ? 'bg-red-100 text-red-800'
                              : log.action === 'suspend'
                                ? 'bg-amber-100 text-amber-800'
                                : log.action === 'warn'
                                  ? 'bg-neutral-100 text-neutral-800'
                                  : 'bg-emerald-100 text-emerald-800')
                          }
                        >
                          {log.action}
                        </span>
                        <span className="text-[#8a847d]">
                          {log.timestamp.toDate().toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[#131312] font-medium pt-1">
                        Reason: {log.reason}
                      </p>
                      <p className="text-[11px] text-[#8a847d]">
                        Admin:{' '}
                        {adminNames[log.adminId] || log.adminId || 'Admin'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Quick Action Panel (1 col) */}
          <div>
            <section className="sticky top-24 rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[#131312]">
                Apply Moderation
              </h3>
              <form
                onSubmit={(e) => void handleModerationSubmit(e)}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="user-mod-action"
                    className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                  >
                    Action
                  </label>
                  <select
                    id="user-mod-action"
                    value={modAction}
                    onChange={(e) =>
                      setModAction(e.target.value as typeof modAction)
                    }
                    className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-xs font-bold text-[#131312] focus:border-[#1f6f5c] focus:outline-none"
                  >
                    <option value="warn">Issue Policy Warning</option>
                    <option value="suspend">Temporary Suspension</option>
                    <option value="ban">Permanent Account Ban</option>
                    <option value="dismiss">Reactivate / Clear</option>
                  </select>
                </div>

                {modAction === 'suspend' && (
                  <div>
                    <label
                      htmlFor="user-suspend-duration"
                      className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                    >
                      Duration
                    </label>
                    <select
                      id="user-suspend-duration"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-xs font-bold text-[#131312] focus:border-[#1f6f5c] focus:outline-none"
                    >
                      <option value={1}>1 Day (24 hrs)</option>
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days (1 week)</option>
                      <option value={30}>30 Days (1 month)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="user-mod-reason"
                    className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                  >
                    Reason
                  </label>
                  <textarea
                    id="user-mod-reason"
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter policy reason for moderation..."
                    className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-xs text-[#131312] placeholder-[#8a847d] focus:border-[#1f6f5c] focus:bg-white focus:outline-none"
                  />
                  {reason.length > 0 &&
                    reason.trim().length < REASON_MIN_LENGTH && (
                      <p className="mt-1 text-xs text-red-700">
                        Reason must be at least {REASON_MIN_LENGTH} characters.
                      </p>
                    )}
                </div>

                <button
                  type="submit"
                  disabled={busy || reason.trim().length < REASON_MIN_LENGTH}
                  className="w-full rounded-full bg-[#131312] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {busy ? 'Applying Action…' : 'Apply Action'}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {/* REACTIVATION MODAL */}
      {reactivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="vc-fade-up w-full max-w-md overflow-hidden rounded-3xl border border-[#ececea] bg-white p-7 shadow-2xl">
            <h3 className="text-lg font-bold text-[#131312]">
              Reactivate User Account
            </h3>
            <p className="mt-1 text-xs text-[#4f4b46]">
              Reinstate account privileges for{' '}
              <strong className="text-[#131312]">{user?.displayName}</strong>.
            </p>

            <form
              onSubmit={(e) => void handleReactivateCommit(e)}
              className="mt-4 space-y-4"
            >
              <div>
                <label
                  htmlFor="reactivate-reason-input"
                  className="block text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d] mb-1.5"
                >
                  Administrative Reinstatement Reason
                </label>
                <textarea
                  id="reactivate-reason-input"
                  required
                  rows={3}
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="Explain reason for lifting restrictions..."
                  className="w-full rounded-xl border border-[#ececea] bg-[#fafaf8] px-3.5 py-2.5 text-xs text-[#131312] placeholder-[#8a847d] focus:border-[#1f6f5c] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReactivateModalOpen(false)}
                  disabled={revoking}
                  className="rounded-full border border-[#ececea] bg-white px-4 py-2 text-xs font-semibold text-[#4f4b46] hover:bg-[#fafaf8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    revoking ||
                    reactivateReason.trim().length < REASON_MIN_LENGTH
                  }
                  className="rounded-full bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
                >
                  {revoking ? 'Reinstating…' : 'Reactivate Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TASK AUDIT TRAIL PANEL
   ============================================================================ */
function TaskAuditPanel() {
  const [taskIdInput, setTaskIdInput] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskActors, setTaskActors] = useState<{
    customerId?: string;
    acceptedVolunteerId?: string;
  } | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  async function handleAuditSearch(e: React.FormEvent) {
    e.preventDefault();
    if (taskIdInput.trim().length === 0) return;

    setError(null);
    setEvents([]);
    setExpandedEventId(null);
    setTaskActors(null);
    setLoading(true);

    try {
      const id = taskIdInput.trim();
      const taskRef = doc(db(), 'tasks', id);
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        setError('Task not found.');
        setLoading(false);
        return;
      }
      const taskData = taskSnap.data() as {
        customerId?: string;
        acceptedVolunteerId?: string;
      };
      setTaskActors({
        ...(taskData.customerId ? { customerId: taskData.customerId } : {}),
        ...(taskData.acceptedVolunteerId
          ? { acceptedVolunteerId: taskData.acceptedVolunteerId }
          : {}),
      });

      const eventsQ = query(
        collection(db(), 'tasks', id, 'events'),
        orderBy('at', 'asc'),
      );
      const eventsSnap = await getDocs(eventsQ);
      setEvents(
        eventsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AuditEvent, 'id'>),
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error searching task audit events.',
      );
    } finally {
      setLoading(false);
    }
  }

  function actorLabel(actorUid: string): string {
    if (actorUid === 'system') return 'System';
    if (taskActors?.customerId && actorUid === taskActors.customerId)
      return 'Customer';
    if (
      taskActors?.acceptedVolunteerId &&
      actorUid === taskActors.acceptedVolunteerId
    ) {
      return 'Volunteer';
    }
    return 'Admin';
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form
        onSubmit={(e) => void handleAuditSearch(e)}
        className="flex max-w-xl gap-2.5"
      >
        <input
          type="text"
          value={taskIdInput}
          onChange={(e) => setTaskIdInput(e.target.value)}
          placeholder="Enter Task ID to inspect lifecycle events..."
          required
          className="w-full rounded-2xl border border-[#ececea] bg-white px-4 py-3 text-xs text-[#131312] placeholder-[#8a847d] focus:border-[#1f6f5c] focus:outline-none shadow-xs"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#131312] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition disabled:opacity-50 flex-shrink-0"
        >
          {loading ? 'Auditing…' : 'Inspect Task'}
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-[#fdf0ef] p-4 text-xs font-semibold text-[#a32a22]">
          {error}
        </div>
      )}

      {events.length > 0 && (
        <section className="vc-fade-up rounded-3xl border border-[#ececea] bg-white p-7 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#f3f1ec] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#131312]">
                Task Lifecycle Timeline
              </h3>
              <p className="mt-0.5 font-mono text-xs text-[#8a847d]">
                Task ID: {taskIdInput.trim()}
              </p>
            </div>
            <Link
              to={`/tasks/${taskIdInput.trim()}`}
              className="text-xs font-semibold text-[#1f6f5c] hover:underline"
            >
              View Task Detail Page →
            </Link>
          </div>

          <ul className="mt-6 space-y-3">
            {events.map((event, eventIdx) => {
              const expanded = expandedEventId === event.id;
              const actor = actorLabel(event.actorUid);
              return (
                <li
                  key={event.id}
                  className="rounded-2xl border border-[#ececea] bg-[#fafaf8]/50 overflow-hidden transition hover:border-[#d8d4cc]"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedEventId(expanded ? null : event.id)
                    }
                    className="flex w-full items-center gap-3.5 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
                  >
                    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[#1f6f5c] text-xs font-bold text-white">
                      {eventIdx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#131312]">
                          {event.type.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-full bg-[#e3efe9] px-2 py-0.5 text-[10px] font-bold text-[#1f6f5c]">
                          {actor}
                        </span>
                      </div>
                      <span className="mt-0.5 block text-xs text-[#8a847d]">
                        {event.at.toDate().toLocaleString()}
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={
                        'flex-shrink-0 text-xs font-bold text-[#8a847d] transition ' +
                        (expanded ? 'rotate-180 text-[#131312]' : '')
                      }
                    >
                      ▼
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-[#ececea] bg-white p-4 text-xs space-y-2">
                      <p className="text-[#4f4b46]">
                        Triggered by:{' '}
                        <strong className="text-[#131312]">{actor}</strong>{' '}
                        <span className="font-mono text-[11px] text-[#8a847d]">
                          ({event.actorUid})
                        </span>
                      </p>
                      {event.payload &&
                        Object.keys(event.payload).length > 0 && (
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a847d]">
                              Event Payload Metadata
                            </span>
                            <pre className="mt-1.5 overflow-x-auto rounded-xl bg-[#fafaf8] border border-[#ececea] p-3 font-mono text-[11px] text-[#131312]">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ============================================================================
   ACTIVITY & AUDIT STREAM PANEL
   ============================================================================ */
interface ActivityLogDoc {
  id: string;
  eventType: string;
  description: string;
  userId: string;
  taskId?: string;
  createdAt: Timestamp;
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  user_registered: 'User Registered',
  task_created: 'Task Created',
  task_accepted: 'Task Accepted',
  task_started: 'Task Started',
  task_completed: 'Task Completed',
  report_submitted: 'Report Submitted',
  moderation_action: 'Moderation Action',
  user_blocked: 'User Blocked',
};

function ActivityLogPanel() {
  const [filter, setFilter] = useState<string>('all');
  const [entries, setEntries] = useState<ActivityLogDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Event Types' },
      ...Object.entries(ACTIVITY_EVENT_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      try {
        const snap = await getDocs(
          query(
            collection(db(), 'activityLog'),
            orderBy('createdAt', 'desc'),
            limit(ACTIVITY_LOG_PAGE_SIZE),
          ),
        );
        if (cancelled) return;
        setEntries(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ActivityLogDoc, 'id'>),
          })),
        );
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.size === ACTIVITY_LOG_PAGE_SIZE);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Could not load activity log.',
        );
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadFirstPage(forFilter: string) {
    setError(null);
    setLoading(true);
    try {
      const base = collection(db(), 'activityLog');
      const q =
        forFilter === 'all'
          ? query(
              base,
              orderBy('createdAt', 'desc'),
              limit(ACTIVITY_LOG_PAGE_SIZE),
            )
          : query(
              base,
              where('eventType', '==', forFilter),
              orderBy('createdAt', 'desc'),
              limit(ACTIVITY_LOG_PAGE_SIZE),
            );
      const snap = await getDocs(q);
      setEntries(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityLogDoc, 'id'>),
        })),
      );
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.size === ACTIVITY_LOG_PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load activity log.',
      );
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(next: string) {
    setFilter(next);
    setEntries([]);
    setLastDoc(null);
    setHasMore(true);
    setExpandedId(null);
    void loadFirstPage(next);
  }

  async function loadMore() {
    if (!lastDoc || !hasMore || loading) return;
    setLoading(true);
    try {
      const base = collection(db(), 'activityLog');
      const q =
        filter === 'all'
          ? query(
              base,
              orderBy('createdAt', 'desc'),
              startAfter(lastDoc),
              limit(ACTIVITY_LOG_PAGE_SIZE),
            )
          : query(
              base,
              where('eventType', '==', filter),
              orderBy('createdAt', 'desc'),
              startAfter(lastDoc),
              limit(ACTIVITY_LOG_PAGE_SIZE),
            );
      const snap = await getDocs(q);
      setEntries((prev) => [
        ...prev,
        ...snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityLogDoc, 'id'>),
        })),
      ]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? lastDoc);
      setHasMore(snap.size === ACTIVITY_LOG_PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load more entries.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="activity-filter"
          className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a847d]"
        >
          Filter Event:
        </label>
        <select
          id="activity-filter"
          value={filter}
          onChange={(e) => changeFilter(e.target.value)}
          className="rounded-xl border border-[#ececea] bg-white px-3.5 py-2 text-xs font-bold text-[#131312] focus:border-[#1f6f5c] focus:outline-none"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-[#fdf0ef] p-4 text-xs font-semibold text-[#a32a22]">
          {error}
        </div>
      )}

      <ul className="space-y-2.5">
        {entries.length === 0 && !loading && (
          <li className="rounded-3xl border border-dashed border-[#ececea] bg-white p-8 text-center text-xs text-[#8a847d]">
            No activity log events found for this filter.
          </li>
        )}
        {entries.map((entry) => {
          const expanded = expandedId === entry.id;
          const label =
            ACTIVITY_EVENT_LABELS[entry.eventType] ?? entry.eventType;
          return (
            <li
              key={entry.id}
              className="vc-fade-up overflow-hidden rounded-2xl border border-[#ececea] bg-white shadow-xs transition hover:border-[#d8d4cc]"
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : entry.id)}
                className="flex w-full items-start gap-3.5 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
              >
                <span className="mt-0.5 rounded-full bg-[#f3f1ec] px-2.5 py-0.5 text-[11px] font-bold text-[#4f4b46]">
                  {label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#131312] truncate">
                    {entry.description}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#8a847d]">
                    {entry.createdAt.toDate().toLocaleString()}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={
                    'flex-shrink-0 text-xs font-bold text-[#8a847d] transition mt-1 ' +
                    (expanded ? 'rotate-180 text-[#131312]' : '')
                  }
                >
                  ▼
                </span>
              </button>

              {expanded && (
                <div className="border-t border-[#f3f1ec] bg-[#fafaf8] p-4 text-xs text-[#4f4b46] space-y-1.5">
                  <p>
                    <span className="text-[#8a847d]">User UID: </span>
                    <span className="font-mono text-[#131312]">
                      {entry.userId}
                    </span>
                  </p>
                  {entry.taskId && (
                    <p>
                      <span className="text-[#8a847d]">Associated Task: </span>
                      <Link
                        to={`/tasks/${entry.taskId}`}
                        className="font-semibold text-[#1f6f5c] underline hover:text-[#185845]"
                      >
                        Inspect Task {entry.taskId} →
                      </Link>
                    </p>
                  )}
                  <p>
                    <span className="text-[#8a847d]">Exact Timestamp: </span>
                    <span className="font-mono text-[#131312]">
                      {entry.createdAt.toDate().toISOString()}
                    </span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full border border-[#ececea] bg-white px-6 py-2.5 text-xs font-bold text-[#4f4b46] shadow-xs hover:bg-[#fafaf8] transition disabled:opacity-50"
          >
            {loading ? 'Loading more…' : 'Load more activity'}
          </button>
        </div>
      )}
    </div>
  );
}
