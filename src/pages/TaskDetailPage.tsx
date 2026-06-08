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
import { KarmaBadge } from '../components/KarmaBadge';
import { KarmaToast } from '../components/KarmaToast';

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

              // Reporting window (mirrors functions/src/report-user.ts):
              //   - accepted / in_progress: always inside the window
              //   - completed: only if completedAt is within 24h
              //   - volunteer side additionally requires status !== 'accepted'
              //     (i.e., Start OTP must have been verified)
              const REPORT_WINDOW_AFTER_COMPLETION_MS = 24 * 60 * 60 * 1000;
              const insideLifecycle =
                task.status === 'accepted' || task.status === 'in_progress';
              const insidePostCompletionWindow =
                task.status === 'completed' &&
                !!task.completedAt &&
                now - task.completedAt.toMillis() <
                  REPORT_WINDOW_AFTER_COMPLETION_MS;
              const inWindow = insideLifecycle || insidePostCompletionWindow;

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

    const subtitle = viewerIsAcceptedVolunteer ? (
      <p className="mt-1 text-sm text-neutral-600">Customer</p>
    ) : (
      accepted && (
        <p className="mt-1 text-sm text-neutral-600">
          {formatDistance(accepted.distanceM)} away · score{' '}
          {accepted.score.toFixed(2)}
        </p>
      )
    );

    const headline =
      task.status === 'in_progress'
        ? 'In progress'
        : viewerIsAcceptedVolunteer
          ? 'You accepted this task'
          : 'Task accepted';

    const chatInstruction = viewerIsAcceptedVolunteer
      ? 'Chat with the customer opens here in M7.'
      : 'Chat with the volunteer opens here in M7.';

    const phase = task.status === 'accepted' ? 'start' : 'end';
    return (
      <>
        <section className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-medium text-emerald-700">{headline}</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-base font-medium text-emerald-800">
              {targetName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-medium text-neutral-900">
                {targetName}
              </p>
              {subtitle}
            </div>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            {chatInstruction}
          </p>
        </section>
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
    <section className="mt-12">
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
      <h2 className="text-lg font-semibold text-neutral-900">
        Pending offers
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        {pending.length === 0
          ? 'Nobody nearby has been offered yet. Volunteers will be matched as they come online.'
          : `${String(pending.length)} ${pending.length === 1 ? 'volunteer has' : 'volunteers have'} been offered. The first to accept gets the task.`}
      </p>
      {pending.length > 0 && (
        <ul className="mt-6 space-y-3">
          {pending.map((o) => {
            const name = o.displayName || 'Volunteer';
            return (
            <li
              key={o.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-medium text-neutral-700">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">
                    {name}
                  </p>
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
