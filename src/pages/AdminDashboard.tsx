import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import { db, functions } from '../lib/firebase';

interface ReportDoc {
  id: string;
  reporterUid: string;
  reportedUid: string;
  taskId: string;
  reason: string;
  details: string;
  status: 'pending' | 'actioned' | 'dismissed';
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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'tasks'>('reports');
  
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
        </div>

        {/* Tab Panels */}
        <div className="mt-8">
          {activeTab === 'reports' && <PendingReportsPanel />}
          {activeTab === 'users' && <UserLookupPanel />}
          {activeTab === 'tasks' && <TaskAuditPanel />}
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

  // Moderation state
  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [modAction, setModAction] = useState<'warn' | 'suspend' | 'ban' | 'dismiss'>('warn');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState(3);

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

  async function handleModerationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReport) return;

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
      setTimeout(() => setActionSuccess(null), 3000);
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
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                    Reason: {report.reason.replace('_', ' ')}
                  </span>
                  <p className="mt-3 text-sm text-neutral-700">
                    <span className="font-semibold text-neutral-900">Details: </span>
                    {report.details || 'No details provided.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
                    <span>
                      <span className="font-medium text-neutral-800">Reporter: </span>
                      {report.reporterUid}
                    </span>
                    <span>
                      <span className="font-medium text-neutral-800">Reported User: </span>
                      {report.reportedUid}
                    </span>
                    <span>
                      <span className="font-medium text-neutral-800">Task Link: </span>
                      <Link
                        to={`/tasks/${report.taskId}`}
                        className="text-neutral-900 underline hover:text-neutral-700 font-semibold"
                      >
                        {report.taskId}
                      </Link>
                    </span>
                    <span>
                      {report.createdAt.toDate().toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedReport(report);
                    setModAction('warn');
                  }}
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 focus:outline-none"
                >
                  Action Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTION REPORT MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <h2 className="text-xl font-semibold text-neutral-900">Action Safety Report</h2>
            <p className="mt-1 text-xs text-neutral-600">
              Apply moderation to user: <span className="font-semibold">{selectedReport.reportedUid}</span>
            </p>

            <form onSubmit={(e) => void handleModerationSubmit(e)} className="mt-6">
              <div>
                <label htmlFor="mod-action" className="block text-sm font-medium text-neutral-700">
                  Moderation Action
                </label>
                <select
                  id="mod-action"
                  value={modAction}
                  onChange={(e) => setModAction(e.target.value as typeof modAction)}
                  className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="warn">Issue Warning (persistent banner)</option>
                  <option value="suspend">Temporary Suspension (locked access)</option>
                  <option value="ban">Permanent Ban (deactivated)</option>
                  <option value="dismiss">Dismiss Report (no action)</option>
                </select>
              </div>

              {modAction === 'suspend' && (
                <div className="mt-4">
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

              <div className="mt-4">
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
                  disabled={busyReportId !== null}
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

      setTimeout(() => setActionSuccess(null), 3000);
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
                      <p className="mt-0.5 text-xs text-neutral-500">Admin: {log.adminId}</p>
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
                </div>

                <button
                  type="submit"
                  disabled={busy}
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

  async function handleAuditSearch(e: React.FormEvent) {
    e.preventDefault();
    if (taskIdInput.trim().length === 0) return;

    setError(null);
    setEvents([]);
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

  return (
    <div>
      <form onSubmit={(e) => void handleAuditSearch(e)} className="flex max-w-md gap-3">
        <input
          type="text"
          value={taskIdInput}
          onChange={(e) => setTaskIdInput(e.target.value)}
          placeholder="Enter Task ID (UUID)..."
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

          <div className="mt-6 flow-root">
            <ul className="-mb-8">
              {events.map((event, eventIdx) => (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {eventIdx !== events.length - 1 ? (
                      <span
                        className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-neutral-200"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 ring-8 ring-white text-xs font-semibold text-neutral-700">
                          {eventIdx + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            Status transition: <span className="uppercase text-neutral-950 font-semibold">{event.type.replace('_', ' ')}</span>
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Triggered by actor UID: <span className="font-mono">{event.actorUid}</span>
                          </p>
                          {event.payload && Object.keys(event.payload).length > 0 && (
                            <pre className="mt-2 text-xs bg-neutral-50 p-2 rounded-md font-mono text-neutral-700 max-w-full overflow-x-auto">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                        <div className="text-right text-xs whitespace-nowrap text-neutral-500">
                          {event.at.toDate().toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
