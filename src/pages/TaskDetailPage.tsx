// Customer view of one task plus its offers + lifecycle state.
// Subscribes live to:
//   - tasks/{id}          (status, acceptedVolunteerId)
//   - tasks/{id}/offers   (dispatchOffers writes these on task create)
// When task.status === 'searching' the page shows the offered volunteers
// queue. When 'accepted' it shows only the accepted volunteer prominently.
// Chat (M7), Start/End OTP (M6) hook in here in later milestones.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { getCategory, getSkillLabel } from '../lib/catalog';
import { CustomerOtpPanel } from '../components/CustomerOtpPanel';
import { VolunteerOtpPanel } from '../components/VolunteerOtpPanel';
import { CustomerRatingPanel } from '../components/CustomerRatingPanel';
import { ReportBlockPanel } from '../components/ReportBlockPanel';
import { ChatPanel } from '../components/ChatPanel';
import { KarmaBadge } from '../components/KarmaBadge';
import { KarmaToast } from '../components/KarmaToast';
import { PostCompletionSuggestionCard } from '../components/PostCompletionSuggestionCard';

type TaskStatus =
  | 'searching'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface TaskDoc {
  customerId: string;
  title: string;
  category: string;
  requiredSkills: string[];
  description: {
    meetingPoint: string;
    whatToBring?: string;
    preference?: string;
    safetyNote?: string;
  };
  location: { lat: number; lng: number; h3Cell: string };
  riskLevel: 'low' | 'medium';
  estimatedMinutes: number;
  status: TaskStatus;
  searchRadiusM: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedVolunteerId?: string;
  acceptedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  customerRating?: number;
  customerRatingComment?: string;
  customerName?: string;
  customerPhotoURL?: string;
}

type OfferState = 'offered' | 'accepted' | 'rejected' | 'superseded' | 'expired';

interface OfferDoc {
  id: string;
  volunteerId: string;
  displayName?: string;        // denormalised by dispatchOffers
  photoURL?: string | null;    // denormalised by dispatchOffers
  state: OfferState;
  score: number;
  scoreBreakdown: {
    distance: number;
    skill: number;
    trust: number;
    availability: number;
    pastCompletion: number;
    reportPenalty: number;
  };
  distanceM: number;
  offeredAt: Timestamp | null;
}

export interface EventDoc {
  type: string;
  actorUid: string;
  at: Timestamp;
  payload?: {
    pointsAwarded?: number;
    durationBonus?: number;
    customerPointsAwarded?: number;
    skillsCredited?: string[];
  };
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const state = useAuthState();
  const [task, setTask] = useState<TaskDoc | null>(null);
  const [offers, setOffers] = useState<OfferDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [completedEvent, setCompletedEvent] = useState<EventDoc | null>(null);
  const [hasReassignedEvent, setHasReassignedEvent] = useState(false);
  // Frozen "now" — used for the 24h post-completion report window check.
  // Refreshing per-render trips react-hooks/purity; the window only matters
  // hours after completion so the mount-time value is plenty accurate.
  const [now] = useState(() => Date.now());
  const prevStatusRef = useRef<TaskStatus | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastPoints, setToastPoints] = useState<number>(0);
  const [hasTriggeredToast, setHasTriggeredToast] = useState(false);

  useEffect(() => {
    if (!taskId || state.status !== 'ready') return;
    const taskRef = doc(db(), 'tasks', taskId);
    const taskUnsub = onSnapshot(
      taskRef,
      (snap) => {
        if (!snap.exists()) {
          setError('Task not found.');
          setLoading(false);
          return;
        }
        setTask(snap.data() as TaskDoc);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const offersQ = query(
      collection(db(), 'tasks', taskId, 'offers'),
      orderBy('score', 'desc'),
    );
    const offersUnsub = onSnapshot(
      offersQ,
      (snap) => {
        setOffers(
          snap.docs.map((d) => {
            const data = d.data() as Omit<OfferDoc, 'id'>;
            return { id: d.id, ...data };
          }),
        );
      },
      () => {
        // Older tasks may have no offers subcollection — that's fine.
      },
    );

    // Subscribe to task events for completion points payload & reassignment checking
    const eventsRef = collection(db(), 'tasks', taskId, 'events');
    const eventsUnsub = onSnapshot(
      eventsRef,
      (snap) => {
        const found = snap.docs.find((d) => d.data().type === 'completed');
        if (found) {
          setCompletedEvent(found.data() as EventDoc);
        } else {
          setCompletedEvent(null);
        }

        const foundReassigned = snap.docs.some((d) => d.data().type === 'reassigned');
        setHasReassignedEvent(foundReassigned);
      },
      () => {
        // Safe to ignore read permission or missing event errors
      }
    );

    return () => {
      taskUnsub();
      offersUnsub();
      eventsUnsub();
    };
  }, [taskId, state.status]);

  // Hook to watch task status transitions and trigger toast alerts
  useEffect(() => {
    if (!task) return;

    if (prevStatusRef.current === null) {
      prevStatusRef.current = task.status;
      return;
    }

    if (task.status === 'completed' && prevStatusRef.current !== 'completed' && !hasTriggeredToast) {
      const isVolunteer = state.status === 'ready' && state.user.uid === task.acceptedVolunteerId;
      const isCustomer = state.status === 'ready' && state.user.uid === task.customerId;
      const viewerIsVolunteer = state.status === 'ready' && (state.userDoc.roles?.includes('volunteer') ?? false);

      if (completedEvent) {
        const payload = completedEvent.payload || {};
        const pts = isVolunteer
          ? (payload.pointsAwarded as number || 0)
          : (isCustomer && viewerIsVolunteer)
            ? (payload.customerPointsAwarded as number || 0)
            : 0;

        if (pts > 0) {
          setTimeout(() => {
            setToastPoints(pts);
            setShowToast(true);
            setHasTriggeredToast(true);
          }, 0);
        }
      }
    }
    prevStatusRef.current = task.status;
  }, [task, completedEvent, hasTriggeredToast, state]);

  // Hook to watch if volunteer is unassigned or task is no longer available to them,
  // and redirect them back to the app home with a toast.
  useEffect(() => {
    if (!task || state.status !== 'ready') return;

    const isVolunteer = state.userDoc.roles?.includes('volunteer') ?? false;
    const isCustomer = state.user.uid === task.customerId;

    // If the viewer is a volunteer, and they are NOT the customer,
    // and the task status is 'searching', it means the task is no longer assigned to them.
    if (isVolunteer && !isCustomer && task.status === 'searching') {
      void navigate('/app', {
        replace: true,
        state: { toastMessage: 'This task is no longer available.' },
      });
    }
  }, [task, state, navigate]);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Link
          to="/app"
          className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
        >
          ← Back
        </Link>
        {loading && <p className="mt-8 text-neutral-600">Loading…</p>}
        {error && (
          <p role="alert" className="mt-8 text-sm text-red-700">
            {error}
          </p>
        )}
        {task && <TaskSummary task={task} />}
        {task && state.status === 'ready' && taskId && (
          <>
            <OffersSection
              task={{ ...task, taskId }}
              offers={offers}
              viewerUid={state.user.uid}
              viewerName={state.userDoc.displayName ?? null}
              completedEvent={completedEvent}
              viewerIsVolunteer={state.userDoc.roles?.includes('volunteer') ?? false}
              hasReassignedEvent={hasReassignedEvent}
            />
            {(() => {
              const viewerUid = state.user.uid;
              const isCustomer = viewerUid === task.customerId;
              const isVolunteer = viewerUid === task.acceptedVolunteerId;
              const hasAcceptedVol = !!task.acceptedVolunteerId;

              // Report/block during accepted + in_progress now live in the
              // chat header (ChatPanel). This standalone panel only covers the
              // post-completion window, where the chat is read-only:
              //   - completed: only if completedAt is within 24h
              //   - volunteer side additionally requires status !== 'accepted'
              //     (always true once completed)
              const REPORT_WINDOW_AFTER_COMPLETION_MS = 24 * 60 * 60 * 1000;
              const insidePostCompletionWindow =
                task.status === 'completed' &&
                !!task.completedAt &&
                now - task.completedAt.toMillis() <
                  REPORT_WINDOW_AFTER_COMPLETION_MS;
              const inWindow = insidePostCompletionWindow;

              // Volunteer can only report once status has moved past
              // 'accepted'. Customer can report anytime in-window.
              const allowedForViewer = isCustomer
                ? true
                : isVolunteer && task.status !== 'accepted';

              const showReportBlock =
                hasAcceptedVol &&
                (isCustomer || isVolunteer) &&
                inWindow &&
                allowedForViewer;

              if (!showReportBlock) return null;

              const acceptedOffer = offers.find((o) => o.state === 'accepted');
              const reportedUserId = isCustomer
                ? task.acceptedVolunteerId!
                : task.customerId;
              const reportedUserName = isCustomer
                ? acceptedOffer?.displayName || 'Volunteer'
                : 'Customer';

              return (
                <ReportBlockPanel
                  taskId={taskId}
                  reportedUserId={reportedUserId}
                  reportedUserName={reportedUserName}
                  viewerRole={isCustomer ? 'customer' : 'volunteer'}
                />
              );
            })()}
          </>
        )}
        {showToast && (
          <KarmaToast
            points={toastPoints}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </main>
  );
}

function TaskSummary({ task }: { task: TaskDoc }) {
  const category = getCategory(task.category);
  return (
    <section className="mt-6">
      <h1 className="text-3xl font-semibold tracking-tight">{task.title}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {category?.label ?? task.category} ·{' '}
        <span
          className={
            task.riskLevel === 'medium'
              ? 'text-amber-700'
              : 'text-emerald-700'
          }
        >
          {task.riskLevel === 'medium' ? 'Medium risk' : 'Low risk'}
        </span>{' '}
        · {task.estimatedMinutes} min
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
        <p>
          <span className="font-medium text-neutral-900">Meeting point: </span>
          {task.description.meetingPoint}
        </p>
        {task.description.whatToBring && (
          <p className="mt-2">
            <span className="font-medium text-neutral-900">To bring: </span>
            {task.description.whatToBring}
          </p>
        )}
        {task.description.preference && (
          <p className="mt-2">
            <span className="font-medium text-neutral-900">Preference: </span>
            {task.description.preference}
          </p>
        )}
        {task.description.safetyNote && (
          <p className="mt-2">
            <span className="font-medium text-neutral-900">Safety note: </span>
            {task.description.safetyNote}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {task.requiredSkills.map((s) => (
          <span
            key={s}
            className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700"
          >
            {getSkillLabel(s)}
          </span>
        ))}
      </div>
    </section>
  );
}

function OffersSection({
  task,
  offers,
  viewerUid,
  viewerName,
  completedEvent,
  viewerIsVolunteer = false,
  hasReassignedEvent = false,
}: {
  task: TaskDoc & { taskId?: string };
  offers: OfferDoc[];
  viewerUid: string;
  viewerName: string | null;
  completedEvent?: EventDoc | null;
  viewerIsVolunteer?: boolean;
  hasReassignedEvent?: boolean;
}) {
  const viewerIsCustomer = viewerUid === task.customerId;
  const viewerIsAcceptedVolunteer = viewerUid === task.acceptedVolunteerId;

  if (task.status === 'accepted' || task.status === 'in_progress') {
    const accepted = offers.find((o) => o.state === 'accepted');
    
    // Choose target display details based on who is viewing
    const targetName = viewerIsAcceptedVolunteer
      ? (task.customerName || 'Customer')
      : (accepted?.displayName || 'Volunteer');

    const subtitle: string | null = viewerIsAcceptedVolunteer
      ? 'Customer'
      : accepted
        ? `${formatDistance(accepted.distanceM)} away · score ${accepted.score.toFixed(2)}`
        : null;

    const headline =
      task.status === 'in_progress'
        ? 'In progress'
        : viewerIsAcceptedVolunteer
          ? 'You accepted this task'
          : 'Task accepted';

    const phase = task.status === 'accepted' ? 'start' : 'end';

    // Chat opens on acceptance. Other party = the person the viewer is NOT.
    const otherPartyUid = viewerIsAcceptedVolunteer
      ? task.customerId
      : (task.acceptedVolunteerId ?? '');
    // Volunteers can only report once the task has started (Start OTP
    // verified). Customers can report any time post-acceptance.
    const canReport = viewerIsCustomer || task.status !== 'accepted';

    return (
      <>
        <section className="vc-fade-up relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f6f5c] to-[#15493b] p-7 text-white shadow-[0_18px_40px_-20px_rgba(31,111,92,0.45)]">
          <span
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-20 right-20 h-40 w-40 rounded-full bg-white/[0.04]"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <span className="vc-check-pop grid h-9 w-9 place-items-center rounded-full bg-white text-[#1f6f5c]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              {headline}
            </span>
          </div>
          <div className="relative mt-5 flex items-center gap-4">
            <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-lg font-bold text-[#5a2900]">
              {targetName.charAt(0).toUpperCase()}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1f6f5c] bg-[#4ade80]"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight">
                {targetName}
              </p>
              {subtitle && (
                <p className="mt-0.5 truncate text-[13px] text-white/80">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </section>
        {task.taskId && otherPartyUid && (
          <ChatPanel
            taskId={task.taskId}
            customerId={task.customerId}
            acceptedVolunteerId={task.acceptedVolunteerId ?? ''}
            status={task.status}
            viewerUid={viewerUid}
            viewerRole={viewerIsCustomer ? 'customer' : 'volunteer'}
            otherPartyUid={otherPartyUid}
            otherPartyName={targetName}
            canReport={canReport}
          />
        )}
        {viewerIsCustomer && (
          <CustomerOtpPanel taskId={task.taskId ?? ''} phase={phase} />
        )}
        {viewerIsAcceptedVolunteer && (
          <VolunteerOtpPanel taskId={task.taskId ?? ''} phase={phase} />
        )}
      </>
    );
  }

  if (task.status === 'completed') {
    const accepted = offers.find((o) => o.state === 'accepted');
    const acceptedName =
      accepted?.displayName
      || (viewerIsAcceptedVolunteer ? viewerName : null)
      || 'Volunteer';

    const payload = completedEvent?.payload || {};
    const volunteerPoints = payload.pointsAwarded as number ?? (10 + Math.min(8, Math.floor((task.estimatedMinutes || 0) / 15)));
    const customerPoints = payload.customerPointsAwarded as number ?? 2;

    return (
      <>
        <section className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-medium text-emerald-700">Completed</p>
          {viewerIsAcceptedVolunteer && (
            <div className="mt-3">
              <p className="text-sm text-neutral-700">
                Nice work. You earned:
              </p>
              <div className="mt-2.5">
                <KarmaBadge points={volunteerPoints} />
              </div>
            </div>
          )}
          {viewerIsCustomer && (
            <div className="mt-3">
              {viewerIsVolunteer ? (
                <>
                  <p className="text-sm text-neutral-700">
                    Task completed successfully. You earned:
                  </p>
                  <div className="mt-2.5">
                    <KarmaBadge points={customerPoints} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-700">
                  Task completed successfully.
                </p>
              )}
              {typeof task.customerRating === 'number' && (
                <p className="mt-4 text-xs text-neutral-500">
                  You rated this volunteer {String(task.customerRating)} / 5.
                </p>
              )}
            </div>
          )}
        </section>
        {viewerIsAcceptedVolunteer && task.taskId && (
          <PostCompletionSuggestionCard
            taskId={task.taskId}
            volunteerUid={viewerUid}
          />
        )}
        {task.taskId && task.acceptedVolunteerId && (
          <ChatPanel
            taskId={task.taskId}
            customerId={task.customerId}
            acceptedVolunteerId={task.acceptedVolunteerId}
            status="completed"
            viewerUid={viewerUid}
            viewerRole={viewerIsCustomer ? 'customer' : 'volunteer'}
            otherPartyUid={
              viewerIsAcceptedVolunteer
                ? task.customerId
                : task.acceptedVolunteerId
            }
            otherPartyName={
              viewerIsAcceptedVolunteer
                ? task.customerName || 'Customer'
                : acceptedName
            }
            canReport={false}
          />
        )}
        {viewerIsCustomer && typeof task.customerRating !== 'number' && (
          <CustomerRatingPanel
            taskId={task.taskId ?? ''}
            volunteerName={acceptedName}
          />
        )}
      </>
    );
  }

  if (
    task.status === 'cancelled' ||
    task.status === 'expired'
  ) {
    return (
      <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-sm font-medium text-neutral-900">
          {task.status === 'cancelled' ? 'Cancelled' : 'Expired'}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Post a new task if you still need help.
        </p>
      </section>
    );
  }

  // status === 'searching'
  // Volunteers shouldn't see the customer's pending-offers queue — only
  // the customer (task owner) sees that. For volunteers, this section is
  // empty during searching state (they reach this page via OfferInbox or
  // AcceptedTasksList only after they've accepted).
  if (!viewerIsCustomer) {
    return null;
  }
  const pending = offers.filter((o) => o.state === 'offered');
  return (
    <section className="mt-10">
      {hasReassignedEvent && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm flex gap-3">
          <svg
            className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin"
            style={{ animationDuration: '3s' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18"
            />
          </svg>
          <div>
            <p className="font-semibold text-sm">Reassigning your task to nearby volunteers...</p>
            <p className="mt-1 text-xs text-blue-800">
              The assigned volunteer is no longer available. We are automatically looking for another volunteer to take over.
            </p>
          </div>
        </div>
      )}

      <RadarSearching
        reachedCount={pending.length}
        radiusM={task.searchRadiusM ?? 2000}
        startedAt={task.createdAt}
        customerInitial={(task.customerName ?? 'You').charAt(0).toUpperCase()}
        recentBlips={pending.slice(0, 6)}
      />

      {pending.length > 0 && (
        <ul className="vc-fade-up mt-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
            Pending offers ({pending.length})
          </p>
          {pending.map((o) => {
            const name = o.displayName || 'Volunteer';
            return (
              <li
                key={o.id}
                className="vc-fade-up rounded-2xl border border-[#ececea] bg-white p-5 transition hover:border-[#d8d4cc]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-base font-semibold text-[#5a2900]">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{name}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {formatDistance(o.distanceM)} away · score{' '}
                      {o.score.toFixed(2)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <ScoreChip label="Dist" value={o.scoreBreakdown.distance} />
                      <ScoreChip label="Skill" value={o.scoreBreakdown.skill} />
                      <ScoreChip label="Trust" value={o.scoreBreakdown.trust} />
                      <ScoreChip
                        label="Past"
                        value={o.scoreBreakdown.pastCompletion}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Radar searching visual. Pulsing rings + fade-in volunteer blips driven
// by the real `offers` count. No rotating sweep — explicitly removed
// per design chat 2026-06-14. Headline progresses through three states
// based on reached count + elapsed time.
function RadarSearching({
  reachedCount,
  radiusM,
  startedAt,
  customerInitial,
  recentBlips,
}: {
  reachedCount: number;
  radiusM: number;
  startedAt: Timestamp | null;
  customerInitial: string;
  recentBlips: OfferDoc[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt.toMillis()) : 0;
  const elapsedTotal = Math.floor(elapsedMs / 1000);
  const elapsedMins = Math.floor(elapsedTotal / 60);
  const elapsedSecs = elapsedTotal % 60;
  const timerLabel = `${String(elapsedMins)}:${elapsedSecs.toString().padStart(2, '0')}`;

  const headline =
    reachedCount === 0
      ? 'Searching for volunteers nearby…'
      : reachedCount === 1
        ? `Found ${String(reachedCount)} nearby volunteer`
        : `Found ${String(reachedCount)} nearby volunteers`;

  // Deterministic blip placement around the circle (no random reshuffle
  // on every render). Up to 6 blips, evenly distributed at 2 radii.
  const blipPositions: Array<{ x: number; y: number; label: string }> =
    recentBlips.map((o, i) => {
      const total = recentBlips.length;
      const angle = (i / total) * Math.PI * 2 + (Math.PI / 5);
      const r = i % 2 === 0 ? 32 : 42;
      const x = 50 + Math.cos(angle) * r;
      const y = 50 + Math.sin(angle) * r;
      return {
        x,
        y,
        label: (o.displayName ?? 'V').charAt(0).toUpperCase(),
      };
    });

  return (
    <div className="vc-fade-up relative overflow-hidden rounded-3xl border border-[#ececea] bg-white px-7 py-9 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(31,111,92,0.06) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto h-[320px] w-[320px] max-w-full">
        {/* concentric radar grid */}
        <div
          className="absolute inset-0 rounded-full border border-[#1f6f5c]/15"
          aria-hidden="true"
        >
          <div className="absolute inset-[22%] rounded-full border border-dashed border-[#1f6f5c]/20" />
          <div className="absolute inset-[44%] rounded-full border border-dashed border-[#1f6f5c]/20" />
        </div>
        {/* axes */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-[#1f6f5c]/10" />
          <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-[#1f6f5c]/10" />
        </div>
        {/* pulsing rings */}
        <div
          className="vc-radar-ping absolute left-1/2 top-1/2 -ml-[10px] -mt-[10px] h-5 w-5 rounded-full border-2 border-[#1f6f5c]"
          aria-hidden="true"
        />
        <div
          className="vc-radar-ping absolute left-1/2 top-1/2 -ml-[10px] -mt-[10px] h-5 w-5 rounded-full border-2 border-[#1f6f5c]"
          style={{ animationDelay: '0.85s' }}
          aria-hidden="true"
        />
        <div
          className="vc-radar-ping absolute left-1/2 top-1/2 -ml-[10px] -mt-[10px] h-5 w-5 rounded-full border-2 border-[#1f6f5c]"
          style={{ animationDelay: '1.7s' }}
          aria-hidden="true"
        />
        {/* volunteer blips */}
        {blipPositions.map((b, i) => (
          <span
            key={i}
            className="vc-blip-in absolute grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#1f6f5c] text-[11px] font-semibold text-white shadow-md"
            style={{
              left: `${b.x.toFixed(2)}%`,
              top: `${b.y.toFixed(2)}%`,
              animationDelay: `${(i * 0.18).toFixed(2)}s`,
            }}
            aria-hidden="true"
          >
            {b.label}
          </span>
        ))}
        {/* customer pin */}
        <span
          className="vc-radar-me absolute left-1/2 top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-base font-bold text-[#5a2900] shadow-lg"
          aria-hidden="true"
        >
          {customerInitial}
        </span>
      </div>

      <h2 className="mt-5 text-xl font-bold tracking-tight text-[#131312]">
        {headline}
      </h2>
      <p className="mt-1.5 text-sm text-[#4f4b46]">
        Pinging volunteers within{' '}
        <span className="font-semibold">{(radiusM / 1000).toFixed(1)} km</span>.
      </p>

      <div className="relative mt-6 inline-flex flex-wrap items-center justify-center gap-6 rounded-full border border-[#ececea] bg-white px-6 py-3 text-[12px] font-medium text-[#4f4b46]">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-base font-semibold text-[#131312]">
            {reachedCount}
          </span>{' '}
          reached
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-base font-semibold text-[#131312]">
            {(radiusM / 1000).toFixed(1)}
          </span>{' '}
          km radius
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="font-mono text-base font-semibold text-[#131312]">
            {timerLabel}
          </span>
        </span>
      </div>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
      {label} {value.toFixed(2)}
    </span>
  );
}

function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return 'unknown distance';
  if (m < 1000) return `${String(Math.round(m))} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
