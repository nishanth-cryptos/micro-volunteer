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

const REASON_MIN_LENGTH = 10;
const AUTO_DISMISS_MS = 3000;
const ACTIVITY_LOG_PAGE_SIZE = 50;

interface ReportDoc {
  id: string;
  reporterUid: string;
  reportedUid: string;
  taskId: string;
  reason: string;
  details: string;
  status: 'pending' | 'actioned' | 'dismissed';
  // Number of unique reporters who have filed against this (reportedUid,
  // taskId) pair. Maintained server-side in functions/src/report-user.ts.
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
    // We can query all of these using onSnapshot to keep stats live or fetch once
    // In emulator, fetching once or watching is very fast.
    const usersQ = query(collection(db(), 'users'));
    const completedTasksQ = query(collection(db(), 'tasks'), where('status', '==', 'completed'));
    const openReportsQ = query(collection(db(), 'reports'), where('status', '==', 'pending'));

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
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Manage safety reports, audit tasks, and moderate user accounts.
            </p>
          </div>
          <Link
            to="/app"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Go to App Home
          </Link>
        </div>

        {/* Stats Bar */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Users
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {statsLoading ? '...' : stats.totalUsers}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Tasks Completed
            </p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">
              {statsLoading ? '...' : stats.completedTasks}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Open Reports
            </p>
            <p className="mt-2 text-3xl font-semibold text-red-600">
              {statsLoading ? '...' : stats.openReports}
            </p>
          </div>
        </section>

        {/* Tab Buttons */}
        <div className="mt-10 flex border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={
              'border-b-2 px-6 py-3 text-sm font-medium transition focus:outline-none ' +
              (activeTab === 'reports'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-900')
            }
          >
            Pending Reports ({stats.openReports})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={
              'border-b-2 px-6 py-3 text-sm font-medium transition focus:outline-none ' +
              (activeTab === 'users'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-900')
            }
          >
            User Lookup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={
              'border-b-2 px-6 py-3 text-sm font-medium transition focus:outline-none ' +
              (activeTab === 'tasks'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-900')
            }
          >
            Task Audit Trail
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={
              'border-b-2 px-6 py-3 text-sm font-medium transition focus:outline-none ' +
              (activeTab === 'activity'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-900')
            }
          >
            Activity Log
          </button>
        </div>

        {/* Tab Panels */}
        <div className="mt-8">
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

  // Cache of resolved display names keyed by uid. `null` marks a uid we
  // already tried to resolve but couldn't (missing/deleted user doc) so
  // we don't refetch on every snapshot tick.
  const [userNames, setUserNames] = useState<Record<string, string | null>>({});
  // Cache of (customerId, acceptedVolunteerId) per taskId so we can derive
  // the reporter's role (Customer / Volunteer) without surfacing UIDs.
  const [taskMap, setTaskMap] = useState<
    Record<string, { customerId: string; acceptedVolunteerId?: string }>
  >({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Moderation state
  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [modAction, setModAction] = useState<'warn' | 'suspend' | 'ban' | 'dismiss'>('warn');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState(3);

  // Auto-dismiss the success banner. Errors also clear after the same
  // window so transient failures don't sit on screen forever.
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
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportDoc, 'id'>) })),
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

  // Resolve display names for any new (reporter, reported, customer,
  // volunteer) uids appearing in the report list or its associated tasks.
  // firestore.rules grants admins read access to users/{uid}, so a direct
  // getDoc is fine here.
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
          const data = snap.exists() ? (snap.data() as { displayName?: string }) : null;
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

  // Resolve task customer/volunteer ids so we can label the reporter's role
  // (Customer / Volunteer) without surfacing UIDs.
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
            ? { customerId: data.customerId, acceptedVolunteerId: data.acceptedVolunteerId }
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

      setActionSuccess(`Successfully applied ${modAction} to user.`);
      setSelectedReport(null);
      setReason('');
      // auto-dismiss handled by useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply moderation action.');
    } finally {
      setBusyReportId(null);
    }
  }

  if (loading) return <p className="text-neutral-600 text-sm">Loading reports...</p>;
  if (error && !selectedReport) return <p className="text-red-700 text-sm font-medium">{error}</p>;

  return (
    <div>
      {actionSuccess && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 animate-fade-in">
          {actionSuccess}
        </div>
      )}

      {reports.length === 0 ? (
        <p className="text-neutral-600 text-sm">No pending reports in queue.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const expanded = expandedId === report.id;
            const role = reporterRole(report);
            const reportedName = userNames[report.reportedUid] ?? '…';
            return (
              <div
                key={report.id}
                className="rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                {/* Collapsed header — always rendered, acts as the toggle */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                        {role}
                      </span>
                      <span className="text-sm font-medium text-neutral-900 truncate">
                        reported {reportedName}
                      </span>
                      <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">
                        {report.reason.replace('_', ' ')}
                      </span>
                      {(report.uniqueReporterCount ?? 1) > 1 && (
                        <span
                          className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
                          title="Unique reporters against this user on this task"
                        >
                          {report.uniqueReporterCount} reporters
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {report.createdAt.toDate().toLocaleString()}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className={
                      'flex-shrink-0 text-neutral-400 transition ' +
                      (expanded ? 'rotate-180' : '')
                    }
                  >
                    ▾
                  </span>
                </button>

                {/* Expanded body */}
                {expanded && (() => {
                  const t = taskMap[report.taskId];
                  const customerName = t
                    ? userNames[t.customerId] ?? '…'
                    : undefined;
                  const volunteerUid = t?.acceptedVolunteerId;
                  const volunteerName = volunteerUid
                    ? userNames[volunteerUid] ?? '…'
                    : undefined;
                  return (
                  <div className="border-t border-neutral-100 px-5 py-4">
                    <p className="text-sm text-neutral-700">
                      <span className="font-semibold text-neutral-900">Details: </span>
                      {report.details || 'No details provided.'}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-y-1.5 text-xs text-neutral-600 sm:grid-cols-2 sm:gap-x-6">
                      {t && (
                        <span>
                          <span className="font-medium text-neutral-800">Customer: </span>
                          <span className="text-neutral-900 font-medium">{customerName}</span>
                          <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                            ({t.customerId})
                          </span>
                        </span>
                      )}
                      {volunteerUid && (
                        <span>
                          <span className="font-medium text-neutral-800">Volunteer: </span>
                          <span className="text-neutral-900 font-medium">{volunteerName}</span>
                          <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                            ({volunteerUid})
                          </span>
                        </span>
                      )}
                      <span>
                        <span className="font-medium text-neutral-800">Task ID: </span>
                        <Link
                          to={`/tasks/${report.taskId}`}
                          className="font-mono text-[11px] text-neutral-900 underline hover:text-neutral-700"
                        >
                          {report.taskId}
                        </Link>
                      </span>
                      <span>
                        <span className="font-medium text-neutral-800">Unique reporters: </span>
                        {report.uniqueReporterCount ?? 1}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(['warn', 'suspend', 'ban', 'dismiss'] as const).map((act) => (
                        <button
                          key={act}
                          type="button"
                          onClick={() => {
                            setSelectedReport(report);
                            setModAction(act);
                            setReason('');
                          }}
                          className={
                            'rounded-full px-4 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
                            (act === 'ban'
                              ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
                              : act === 'suspend'
                                ? 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500'
                                : act === 'warn'
                                  ? 'bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900'
                                  : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 focus-visible:ring-neutral-900')
                          }
                        >
                          {act === 'warn'
                            ? 'Warn'
                            : act === 'suspend'
                              ? 'Suspend'
                              : act === 'ban'
                                ? 'Ban'
                                : 'Dismiss'}
                        </button>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ACTION REPORT MODAL — preset action comes from the inline button
          the admin clicked in the expanded card. */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <h2 className="text-xl font-semibold text-neutral-900">
              {modAction === 'warn'
                ? 'Issue warning'
                : modAction === 'suspend'
                  ? 'Suspend account'
                  : modAction === 'ban'
                    ? 'Ban account'
                    : 'Dismiss report'}
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Target: <span className="font-semibold text-neutral-900">
                {userNames[selectedReport.reportedUid] ?? 'user'}
              </span>
            </p>

            <form onSubmit={(e) => void handleModerationSubmit(e)} className="mt-6">
              {modAction === 'suspend' && (
                <div>
                  <label htmlFor="suspend-duration" className="block text-sm font-medium text-neutral-700">
                    Suspension Duration
                  </label>
                  <select
                    id="suspend-duration"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value={1}>1 Day</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              )}

              <div className={modAction === 'suspend' ? 'mt-4' : ''}>
                <label htmlFor="mod-reason" className="block text-sm font-medium text-neutral-700">
                  Reason (visible to user on warn/suspend/ban, and stored in log)
                </label>
                <textarea
                  id="mod-reason"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for this action..."
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                {reason.length > 0 && reason.trim().length < REASON_MIN_LENGTH && (
                  <p className="mt-1 text-xs text-red-700">
                    Please provide a meaningful reason
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-4 text-sm text-red-700 font-medium">
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  disabled={busyReportId !== null}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busyReportId !== null || reason.trim().length < REASON_MIN_LENGTH
                  }
                  className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none disabled:opacity-50"
                >
                  {busyReportId !== null ? 'Applying...' : 'Apply Action'}
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
   USER LOOKUP PANEL
   ============================================================================ */
function UserLookupPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [modLogs, setModLogs] = useState<ModerationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moderation state
  const [modAction, setModAction] = useState<'warn' | 'suspend' | 'ban' | 'dismiss'>('warn');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Cache of admin display names so the Moderation Log never surfaces raw
  // UIDs. firestore.rules already lets admins read other users/{uid}.
  const [adminNames, setAdminNames] = useState<Record<string, string | null>>({});

  // Auto-dismiss any success / error banner after 3s — matches the same
  // behaviour in PendingReportsPanel for consistency.
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

  // Resolve admin display names referenced in the moderation log.
  useEffect(() => {
    let cancelled = false;
    const uids = new Set(modLogs.map((l) => l.adminId).filter(Boolean));
    const unresolved = [...uids].filter((u) => !(u in adminNames));
    if (unresolved.length === 0) return;
    void Promise.all(
      unresolved.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db(), 'users', uid));
          const data = snap.exists() ? (snap.data() as { displayName?: string }) : null;
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
        setUser({ uid: userSnap.id, ...(userSnap.data() as Omit<UserSummary, 'uid'>) });

        // Load moderation logs
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
        // Try searching by displayName (prefix search)
        const nameQ = query(
          collection(db(), 'users'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
        );
        const nameSnap = await getDocs(nameQ);
        if (!nameSnap.empty) {
          const firstDoc = nameSnap.docs[0];
          if (firstDoc) {
            setUser({ uid: firstDoc.id, ...(firstDoc.data() as Omit<UserSummary, 'uid'>) });
            // Load moderation logs
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
          setError('No user found by UID or display name.');
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

      setActionSuccess(`Successfully applied ${modAction} to user.`);
      setReason('');
      
      // Reload user document and logs
      const userSnap = await getDoc(doc(db(), 'users', user.uid));
      if (userSnap.exists()) {
        setUser({ uid: userSnap.id, ...(userSnap.data() as Omit<UserSummary, 'uid'>) });
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

      // auto-dismiss handled by useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply moderation action.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    if (!user) return;
    const inputReason = prompt('Enter reason for reactivating this account:', 'Account reinstated by administrator.');
    if (inputReason === null) return; // cancelled
    if (inputReason.trim().length === 0) {
      alert('A reason is required to reactivate the account.');
      return;
    }
    
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
        reason: inputReason.trim(),
      });

      setActionSuccess(`Successfully reactivated user account.`);
      
      // Reload user document and logs
      const userSnap = await getDoc(doc(db(), 'users', user.uid));
      if (userSnap.exists()) {
        setUser({ uid: userSnap.id, ...(userSnap.data() as Omit<UserSummary, 'uid'>) });
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
      setError(err instanceof Error ? err.message : 'Could not reactivate account.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <form onSubmit={(e) => void handleSearch(e)} className="flex max-w-md gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by User UID or display name..."
          required
          className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-700 text-sm font-medium">{error}</p>}
      {actionSuccess && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {user && (
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* User profile details */}
          <div className="md:col-span-2 space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900">Profile Summary</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xl font-semibold text-neutral-700">
                  {(user.displayName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-semibold text-neutral-950">
                    {user.displayName ?? 'Unnamed User'}
                  </h4>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{user.uid}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {user.phoneNumber} {user.email ? `· ${user.email}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-6 text-sm">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Account Status</p>
                  <p className="mt-1 font-semibold uppercase text-neutral-900 flex flex-wrap items-center gap-3">
                    <span
                      className={
                        user.accountStatus === 'banned'
                          ? 'text-red-700'
                          : user.accountStatus === 'suspended'
                            ? 'text-amber-700'
                            : user.accountStatus === 'warned'
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                      }
                    >
                      {user.accountStatus ?? 'active'}
                    </span>
                    {user.accountStatus && user.accountStatus !== 'active' && (
                      <button
                        type="button"
                        onClick={() => void handleReactivate()}
                        disabled={revoking}
                        className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition focus:outline-none disabled:opacity-50 cursor-pointer"
                      >
                        {revoking ? 'Reactivating...' : 'Reactivate / Lift'}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Trust Score</p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {user.trustScore ?? 30} / 100
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Verified Tasks / Hours</p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {user.verifiedTaskCount ?? 0} tasks ({user.verifiedHours?.toFixed(1) ?? '0.0'}h)
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Pending / Total Reports</p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {user.pendingReports ?? 0} pending ({user.reportPenalty ?? 0} penalty)
                  </p>
                </div>
              </div>

              {user.accountStatus === 'suspended' && user.suspendedUntil && (
                <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
                  <span className="font-semibold">Suspended Until: </span>
                  {user.suspendedUntil.toDate().toLocaleString()}
                </div>
              )}
            </section>

            {/* Moderation log */}
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900 font-medium">Moderation Log</h3>
              {modLogs.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No moderation events logged for this user.</p>
              ) : (
                <ul className="mt-4 divide-y divide-neutral-100">
                  {modLogs.map((log) => (
                    <li key={log.id} className="py-3 text-sm">
                      <div className="flex justify-between font-medium">
                        <span className="uppercase text-neutral-900">{log.action}</span>
                        <span className="text-xs text-neutral-500">
                          {log.timestamp.toDate().toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-neutral-600">Reason: {log.reason}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Admin: {adminNames[log.adminId] || 'Admin'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Quick Moderation Action Panel */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-neutral-900">Moderate User</h3>
              <form onSubmit={(e) => void handleModerationSubmit(e)} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="mod-action-lookup" className="block text-xs font-semibold text-neutral-500">
                    Action
                  </label>
                  <select
                    id="mod-action-lookup"
                    value={modAction}
                    onChange={(e) => setModAction(e.target.value as typeof modAction)}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="warn">Issue Warning</option>
                    <option value="suspend">Temporary Suspension</option>
                    <option value="ban">Permanent Ban</option>
                    <option value="dismiss">Reactivate Account / Dismiss</option>
                  </select>
                </div>

                {modAction === 'suspend' && (
                  <div>
                    <label htmlFor="suspend-duration-lookup" className="block text-xs font-semibold text-neutral-500">
                      Suspension Duration
                    </label>
                    <select
                      id="suspend-duration-lookup"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    >
                      <option value={1}>1 Day</option>
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="mod-reason-lookup" className="block text-xs font-semibold text-neutral-500">
                    Reason
                  </label>
                  <textarea
                    id="mod-reason-lookup"
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  {reason.length > 0 && reason.trim().length < REASON_MIN_LENGTH && (
                    <p className="mt-1 text-xs text-red-700">
                      Please provide a meaningful reason
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy || reason.trim().length < REASON_MIN_LENGTH}
                  className="w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy ? 'Applying...' : 'Apply Action'}
                </button>
              </form>
            </section>
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
  // Customer / volunteer ids for the loaded task — used to label the
  // actor of each audit event as a role (never a raw UID).
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

      // Query subcollection events
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
      setError(err instanceof Error ? err.message : 'Error searching task audit events.');
    } finally {
      setLoading(false);
    }
  }

  function actorLabel(actorUid: string): string {
    if (actorUid === 'system') return 'System';
    if (taskActors?.customerId && actorUid === taskActors.customerId) return 'Customer';
    if (
      taskActors?.acceptedVolunteerId &&
      actorUid === taskActors.acceptedVolunteerId
    ) {
      return 'Volunteer';
    }
    return 'Admin';
  }

  return (
    <div>
      <form onSubmit={(e) => void handleAuditSearch(e)} className="flex max-w-md gap-3">
        <input
          type="text"
          value={taskIdInput}
          onChange={(e) => setTaskIdInput(e.target.value)}
          placeholder="Enter Task ID"
          required
          className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {loading ? 'Searching...' : 'Audit'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-700 text-sm font-medium">{error}</p>}

      {events.length > 0 && (
        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900">Task Lifecycle History</h3>
          <p className="mt-1 text-xs text-neutral-500 font-mono">ID: {taskIdInput.trim()}</p>

          <ul className="mt-6 space-y-2">
            {events.map((event, eventIdx) => {
              const expanded = expandedEventId === event.id;
              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-neutral-200"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedEventId(expanded ? null : event.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                      {eventIdx + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-neutral-900 uppercase tracking-wide">
                        {event.type.replace('_', ' ')}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {event.at.toDate().toLocaleString()}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={
                        'flex-shrink-0 text-neutral-400 transition ' +
                        (expanded ? 'rotate-180' : '')
                      }
                    >
                      ▾
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-neutral-100 px-4 py-3">
                      <p className="text-xs text-neutral-500">
                        Triggered by:{' '}
                        <span className="font-medium text-neutral-900">
                          {actorLabel(event.actorUid)}
                        </span>
                      </p>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <pre className="mt-2 text-xs bg-neutral-50 p-2 rounded-md font-mono text-neutral-700 max-w-full overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
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
   ACTIVITY LOG PANEL
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
  user_registered: 'User registered',
  task_created: 'Task created',
  task_accepted: 'Task accepted',
  task_started: 'Task started',
  task_completed: 'Task completed',
  report_submitted: 'Report submitted',
  moderation_action: 'Moderation action',
  user_blocked: 'User blocked',
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
      { value: 'all', label: 'All event types' },
      ...Object.entries(ACTIVITY_EVENT_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    [],
  );

  // Initial load on mount. Filter changes go through changeFilter() which
  // both resets state and kicks the same loader — keeps the effect free
  // of synchronous setState calls (react-hooks/set-state-in-effect).
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
        setError(err instanceof Error ? err.message : 'Could not load activity log.');
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
      setError(err instanceof Error ? err.message : 'Could not load activity log.');
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
      setError(err instanceof Error ? err.message : 'Could not load more entries.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <label htmlFor="activity-filter" className="text-xs font-semibold text-neutral-500">
          Filter:
        </label>
        <select
          id="activity-filter"
          value={filter}
          onChange={(e) => changeFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 font-medium">
          {error}
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {entries.length === 0 && !loading && (
          <li className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            No activity yet.
          </li>
        )}
        {entries.map((entry) => {
          const expanded = expandedId === entry.id;
          const label = ACTIVITY_EVENT_LABELS[entry.eventType] ?? entry.eventType;
          return (
            <li
              key={entry.id}
              className="rounded-xl border border-neutral-200 bg-white"
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : entry.id)}
                className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              >
                <span className="mt-0.5 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                  {label}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-neutral-900 truncate">
                    {entry.description}
                  </span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {entry.createdAt.toDate().toLocaleString()}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={
                    'flex-shrink-0 text-neutral-400 transition mt-1 ' +
                    (expanded ? 'rotate-180' : '')
                  }
                >
                  ▾
                </span>
              </button>
              {expanded && (
                <div className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600 space-y-1">
                  <p>
                    <span className="font-medium text-neutral-800">Event type: </span>
                    {label}
                  </p>
                  {entry.taskId && (
                    <p>
                      <span className="font-medium text-neutral-800">Task: </span>
                      <Link
                        to={`/tasks/${entry.taskId}`}
                        className="text-neutral-900 underline hover:text-neutral-700 font-medium"
                      >
                        Open task
                      </Link>
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-neutral-800">Recorded: </span>
                    {entry.createdAt.toDate().toLocaleString()}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
