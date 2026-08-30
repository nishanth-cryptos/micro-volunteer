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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { getCategory, getSkillLabel } from '../lib/catalog';
import { CustomerOtpPanel } from '../components/CustomerOtpPanel';
import { VolunteerOtpPanel } from '../components/VolunteerOtpPanel';
import { CustomerRatingPanel } from '../components/CustomerRatingPanel';
import { ReportBlockPanel } from '../components/ReportBlockPanel';
import { ChatPanel } from '../components/ChatPanel';
import { KarmaToast } from '../components/KarmaToast';
import {
  ReasonBottomSheet,
  type ReasonOption,
} from '../components/ReasonBottomSheet';

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
  expectedWaitTier?: 'fast' | 'normal' | 'flexible';
  waitStartedAt?: Timestamp;
  lastNudgeStage?: 0 | 1 | 2 | 3;
  statusMessage?: string | null;
  nearingExpiry?: boolean;
}

type OfferState =
  | 'offered'
  | 'accepted'
  | 'rejected'
  | 'superseded'
  | 'expired';

interface OfferDoc {
  id: string;
  volunteerId: string;
  displayName?: string; // denormalised by dispatchOffers
  photoURL?: string | null; // denormalised by dispatchOffers
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

const VOLUNTEER_CANCEL_REASONS: ReasonOption[] = [
  { id: 'accidental_accept', label: 'Accidentally accepted' },
  { id: 'other_commitments', label: 'Got other commitments' },
  { id: 'cant_reach_location', label: "Can't get to the location" },
  { id: 'other', label: 'Other / prefer not to say' },
];

const CUSTOMER_DELETE_REASONS: ReasonOption[] = [
  { id: 'accidental_post', label: 'Accidentally posted' },
  { id: 'no_longer_needed', label: 'No longer needed' },
  { id: 'found_help_elsewhere', label: 'Found help another way' },
  { id: 'other', label: 'Other / prefer not to say' },
];

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
  const [now] = useState(() => Date.now());
  const prevStatusRef = useRef<TaskStatus | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastPoints, setToastPoints] = useState<number>(0);
  const [hasTriggeredToast, setHasTriggeredToast] = useState(false);

  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleVolunteerCancel(reasonId: string) {
    if (!taskId) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const fn = httpsCallable<
        { taskId: string; reason: string },
        { success: boolean }
      >(functions(), 'cancelAcceptedTask');
      await fn({ taskId, reason: reasonId });
      setCancelSheetOpen(false);
      void navigate('/app', {
        replace: true,
        state: { toastMessage: 'Task cancellation submitted.' },
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not cancel task.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCustomerDelete(reasonId: string) {
    if (!taskId) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const fn = httpsCallable<
        { taskId: string; reason: string },
        { success: boolean }
      >(functions(), 'deleteTask');
      await fn({ taskId, reason: reasonId });
      setDeleteSheetOpen(false);
      void navigate('/app', {
        replace: true,
        state: { toastMessage: 'Task deleted.' },
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete task.',
      );
    } finally {
      setActionBusy(false);
    }
  }

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

        const foundReassigned = snap.docs.some(
          (d) => d.data().type === 'reassigned',
        );
        setHasReassignedEvent(foundReassigned);
      },
      () => {
        // Safe to ignore read permission or missing event errors
      },
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

    if (
      task.status === 'completed' &&
      prevStatusRef.current !== 'completed' &&
      !hasTriggeredToast
    ) {
      const isVolunteer =
        state.status === 'ready' && state.user.uid === task.acceptedVolunteerId;
      const isCustomer =
        state.status === 'ready' && state.user.uid === task.customerId;
      const viewerIsVolunteer =
        state.status === 'ready' &&
        (state.userDoc.roles?.includes('volunteer') ?? false);

      if (completedEvent) {
        const payload = completedEvent.payload || {};
        const pts = isVolunteer
          ? (payload.pointsAwarded as number) || 0
          : isCustomer && viewerIsVolunteer
            ? (payload.customerPointsAwarded as number) || 0
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
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ececea] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#4f4b46] transition hover:border-[#d8d4cc] hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to dashboard
        </Link>

        {loading && (
          <div className="mt-8 space-y-4" aria-label="Loading task details">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-[#e8e6e1]" />
            <div className="h-28 w-full animate-pulse rounded-2xl border border-[#ececea] bg-white" />
            <div className="h-44 w-full animate-pulse rounded-3xl border border-[#ececea] bg-white" />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-800"
          >
            <p className="font-semibold">Unable to load task</p>
            <p className="mt-1 text-xs">{error}</p>
            <Link
              to="/app"
              className="mt-3 inline-block rounded-full bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              Return to dashboard
            </Link>
          </div>
        )}

        {task && !loading && (
          <>
            <TaskSummary task={task} />
            <LifecycleProgressTracker status={task.status} />
          </>
        )}

        {task && state.status === 'ready' && taskId && !loading && (
          <>
            <OffersSection
              task={{ ...task, taskId }}
              offers={offers}
              viewerUid={state.user.uid}
              viewerName={state.userDoc.displayName ?? null}
              completedEvent={completedEvent}
              hasReassignedEvent={hasReassignedEvent}
              onOpenCancelSheet={() => setCancelSheetOpen(true)}
              onOpenDeleteSheet={() => setDeleteSheetOpen(true)}
            />
            {(() => {
              const viewerUid = state.user.uid;
              const isCustomer = viewerUid === task.customerId;
              const isVolunteer = viewerUid === task.acceptedVolunteerId;
              const hasAcceptedVol = !!task.acceptedVolunteerId;

              const REPORT_WINDOW_AFTER_COMPLETION_MS = 24 * 60 * 60 * 1000;
              const insidePostCompletionWindow =
                task.status === 'completed' &&
                !!task.completedAt &&
                now - task.completedAt.toMillis() <
                  REPORT_WINDOW_AFTER_COMPLETION_MS;
              const inWindow = insidePostCompletionWindow;

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
        {actionError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-[#fdf0ef] p-3 text-xs text-[#a32a22]"
          >
            {actionError}
          </div>
        )}

        <ReasonBottomSheet
          isOpen={cancelSheetOpen}
          title="Cancel task acceptance?"
          subtitle="Please select a reason. The task will be re-queued for nearby volunteers."
          reasons={VOLUNTEER_CANCEL_REASONS}
          busy={actionBusy}
          onSelect={(reasonId) => void handleVolunteerCancel(reasonId)}
          onClose={() => setCancelSheetOpen(false)}
        />

        <ReasonBottomSheet
          isOpen={deleteSheetOpen}
          title="Delete this task?"
          subtitle="Please select a reason for removing your task posting."
          reasons={CUSTOMER_DELETE_REASONS}
          busy={actionBusy}
          onSelect={(reasonId) => void handleCustomerDelete(reasonId)}
          onClose={() => setDeleteSheetOpen(false)}
        />
      </div>
    </main>
  );
}

function LifecycleProgressTracker({ status }: { status: TaskStatus }) {
  const steps: Array<{ id: TaskStatus; label: string; sub: string }> = [
    {
      id: 'searching',
      label: 'Finding Volunteer',
      sub: 'Searching active verified volunteers nearby...',
    },
    {
      id: 'accepted',
      label: 'Volunteer Matched',
      sub: 'Volunteer matched. Chat to coordinate arrival.',
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      sub: 'Task is actively underway. Have your end code ready.',
    },
    {
      id: 'completed',
      label: 'Completed',
      sub: 'Task verified & completed successfully.',
    },
  ];

  const getStepIndex = (s: TaskStatus) => {
    switch (s) {
      case 'searching':
        return 0;
      case 'accepted':
        return 1;
      case 'in_progress':
        return 2;
      case 'completed':
        return 3;
      default:
        return -1;
    }
  };

  const currentIndex = getStepIndex(status);
  if (currentIndex === -1) return null;

  return (
    <div className="vc-fade-up mt-6 rounded-3xl border border-[#ececea] bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {steps.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={step.id}
              className="flex flex-1 items-center gap-1 sm:gap-2"
            >
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-[#1f6f5c] text-white'
                      : isCurrent
                        ? 'bg-[#1f6f5c] text-white ring-4 ring-[#1f6f5c]/20'
                        : 'bg-[#f3f1ec] text-[#8a847d]'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span
                  className={`mt-1.5 text-center text-[10px] sm:text-xs font-semibold ${
                    isCurrent
                      ? 'text-[#1f6f5c]'
                      : isDone
                        ? 'text-[#131312]'
                        : 'text-[#8a847d]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mb-5 transition-all ${
                    idx < currentIndex ? 'bg-[#1f6f5c]' : 'bg-[#ececea]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3.5 border-t border-[#f3f1ec] pt-3 text-center text-xs font-medium text-[#4f4b46]">
        {steps[currentIndex]?.sub}
      </p>
    </div>
  );
}

function TaskSummary({ task }: { task: TaskDoc }) {
  const category = getCategory(task.category);
  return (
    <section className="mt-6 rounded-3xl border border-[#ececea] bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#131312]">
            {task.title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[#4f4b46]">
            <span className="font-semibold text-[#131312]">
              {category?.label ?? task.category}
            </span>
            <span>·</span>
            <span
              className={
                task.riskLevel === 'medium'
                  ? 'rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-semibold text-[#b45309]'
                  : 'rounded-full bg-[#e3efe9] px-2.5 py-0.5 text-xs font-semibold text-[#1f6f5c]'
              }
            >
              {task.riskLevel === 'medium'
                ? '🛡️ Verified Volunteer Category'
                : '✓ Standard Task'}
            </span>
            <span>·</span>
            <span>{task.estimatedMinutes} min</span>
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5 rounded-2xl bg-[#fafaf8] border border-[#ececea] p-4 text-xs sm:text-sm text-[#4f4b46]">
        <p>
          <strong className="font-semibold text-[#131312]">
            📍 Meeting point:{' '}
          </strong>
          {task.description.meetingPoint}
        </p>
        {task.description.whatToBring && (
          <p>
            <strong className="font-semibold text-[#131312]">
              🎒 To bring:{' '}
            </strong>
            {task.description.whatToBring}
          </p>
        )}
        {task.description.preference && (
          <p>
            <strong className="font-semibold text-[#131312]">
              💬 Preference:{' '}
            </strong>
            {task.description.preference}
          </p>
        )}
        {task.description.safetyNote && (
          <p>
            <strong className="font-semibold text-[#131312]">⚠️ Note: </strong>
            {task.description.safetyNote}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {task.requiredSkills.map((s) => (
          <span
            key={s}
            className="rounded-full border border-[#ececea] bg-white px-3 py-1 font-medium text-[#4f4b46]"
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
  hasReassignedEvent = false,
  onOpenCancelSheet,
  onOpenDeleteSheet,
}: {
  task: TaskDoc & { taskId?: string };
  offers: OfferDoc[];
  viewerUid: string;
  viewerName: string | null;
  completedEvent?: EventDoc | null;
  hasReassignedEvent?: boolean;
  onOpenCancelSheet?: () => void;
  onOpenDeleteSheet?: () => void;
}) {
  const navigate = useNavigate();
  const viewerIsCustomer = viewerUid === task.customerId;
  const viewerIsAcceptedVolunteer = viewerUid === task.acceptedVolunteerId;

  if (task.status === 'accepted' || task.status === 'in_progress') {
    const accepted = offers.find((o) => o.state === 'accepted');

    // Choose target display details based on who is viewing
    const targetName = viewerIsAcceptedVolunteer
      ? task.customerName || 'Customer'
      : accepted?.displayName || 'Volunteer';

    const subtitle: string | null = viewerIsAcceptedVolunteer
      ? 'Customer · Requester'
      : accepted
        ? `${formatDistance(accepted.distanceM)} away · Verified Volunteer`
        : null;

    const headline =
      task.status === 'in_progress'
        ? 'In progress'
        : viewerIsAcceptedVolunteer
          ? 'You accepted this task'
          : 'Volunteer matched';

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
        <section className="vc-fade-up relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f6f5c] to-[#15493b] p-7 text-white shadow-[0_18px_40px_-20px_rgba(31,111,92,0.45)]">
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
                <p className="mt-0.5 truncate text-[13px] text-white/85">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs text-white/90 backdrop-blur-xs">
            <span className="text-sm">🔒</span>
            <span>
              Privacy protected · Contact info stays private. Coordinate safely
              in chat.
            </span>
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
        {viewerIsAcceptedVolunteer &&
          task.status === 'accepted' &&
          onOpenCancelSheet && (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onOpenCancelSheet}
                className="rounded-full border border-red-200 bg-red-50/70 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300 focus:outline-none"
              >
                Cancel accepted task
              </button>
            </div>
          )}
        {viewerIsCustomer &&
          task.status === 'accepted' &&
          onOpenDeleteSheet && (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onOpenDeleteSheet}
                className="rounded-full border border-red-200 bg-red-50/70 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300 focus:outline-none"
              >
                Delete task
              </button>
            </div>
          )}
      </>
    );
  }

  if (task.status === 'completed') {
    const accepted = offers.find((o) => o.state === 'accepted');
    const acceptedName =
      accepted?.displayName ||
      (viewerIsAcceptedVolunteer ? viewerName : null) ||
      'Volunteer';

    const payload = completedEvent?.payload || {};
    const volunteerPoints =
      (payload.pointsAwarded as number) ??
      10 + Math.min(8, Math.floor((task.estimatedMinutes || 0) / 15));
    const customerPoints = (payload.customerPointsAwarded as number) ?? 2;

    return (
      <>
        <section className="vc-fade-up mt-8 rounded-3xl border border-[#e3efe9] bg-white p-7 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e3efe9] text-[#1f6f5c]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <p className="text-base font-bold text-[#131312]">
                Task verified &amp; completed
              </p>
              <p className="text-xs text-[#4f4b46]">
                Completed with {acceptedName}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-[#fafaf8] border border-[#ececea] p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#4f4b46]">
                Neighbourhood Karma awarded:
              </span>
              <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 font-bold text-[#1f6f5c]">
                +{viewerIsCustomer ? customerPoints : volunteerPoints} pts
              </span>
            </div>
          </div>
        </section>

        {viewerIsCustomer && task.taskId && (
          <CustomerRatingPanel taskId={task.taskId} />
        )}

        {task.taskId && (
          <ChatPanel
            taskId={task.taskId}
            customerId={task.customerId}
            acceptedVolunteerId={task.acceptedVolunteerId ?? ''}
            status="completed"
            viewerUid={viewerUid}
            viewerRole={viewerIsCustomer ? 'customer' : 'volunteer'}
            otherPartyUid={
              viewerIsCustomer
                ? (task.acceptedVolunteerId ?? '')
                : task.customerId
            }
            otherPartyName={acceptedName}
            canReport={false}
          />
        )}
      </>
    );
  }

  if (task.status === 'cancelled' || task.status === 'expired') {
    const isCancelled = task.status === 'cancelled';
    return (
      <section className="vc-fade-up mt-8 rounded-3xl border border-[#ececea] bg-white p-7 text-center shadow-xs">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fef3c7] text-[#b45309]">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-[#131312]">
          {isCancelled
            ? 'This task was cancelled'
            : 'Task expired without a match'}
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#4f4b46]">
          {isCancelled
            ? 'This request was cancelled. If you still need a hand from a neighbour, you can republish it at any time.'
            : 'No active volunteers were available nearby in time. You can republish with adjusted timing or broader details.'}
        </p>
        {viewerIsCustomer && (
          <button
            type="button"
            onClick={() => {
              void navigate('/create-task', {
                state: {
                  prefill: {
                    title: task.title,
                    category: task.category,
                    requiredSkills: task.requiredSkills,
                    estimatedMinutes: task.estimatedMinutes,
                    description: task.description,
                    location: task.location,
                    expectedWaitTier: task.expectedWaitTier,
                  },
                },
              });
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1f6f5c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] shadow-sm"
          >
            <span>↻</span> Republish this task
          </button>
        )}
      </section>
    );
  }

  // status === 'searching'
  if (!viewerIsCustomer) {
    return null;
  }
  const pending = offers.filter((o) => o.state === 'offered');
  return (
    <section className="mt-8">
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
            <p className="font-bold text-sm text-[#1f4baa]">
              Finding another volunteer for your task
            </p>
            <p className="mt-0.5 text-xs text-[#2c5282]">
              The previously assigned volunteer became unavailable. We are
              automatically reaching out to active nearby neighbours to help
              you.
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

      {task.statusMessage && (
        <div
          className={
            'vc-fade-up mt-6 rounded-2xl border p-4.5 text-sm transition-all ' +
            (task.nearingExpiry
              ? 'border-amber-200 bg-amber-50/80 text-amber-900 shadow-sm'
              : 'border-[#ececea] bg-white text-[#4f4b46]')
          }
        >
          <div className="flex items-start gap-3">
            <span
              className={
                'grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-xs font-bold ' +
                (task.nearingExpiry
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-[#e3efe9] text-[#1f6f5c]')
              }
            >
              ℹ
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-relaxed">
                {task.statusMessage}
              </p>

              {task.nearingExpiry ? (
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      /* Keep waiting - acknowledges / no-op */
                    }}
                    className="rounded-full bg-[#1f6f5c] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#185845] focus:outline-none"
                  >
                    Keep waiting
                  </button>
                  {onOpenDeleteSheet && (
                    <button
                      type="button"
                      onClick={onOpenDeleteSheet}
                      className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none"
                    >
                      Cancel task
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {viewerIsCustomer && !task.nearingExpiry && onOpenDeleteSheet && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onOpenDeleteSheet}
            className="rounded-full border border-red-200 bg-red-50/70 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300 focus:outline-none"
          >
            Cancel task
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <ul className="vc-fade-up mt-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8a847d]">
            Nearby active volunteers ({pending.length})
          </p>
          {pending.map((o) => {
            const name = o.displayName || 'Volunteer';
            return (
              <li
                key={o.id}
                className="vc-fade-up rounded-2xl border border-[#ececea] bg-white p-5 transition hover:border-[#d8d4cc] shadow-xs"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd28a] to-[#f08a4b] text-base font-semibold text-[#5a2900]">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#131312]">{name}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[#e3efe9] px-2.5 py-0.5 font-semibold text-[#1f6f5c]">
                        📍 {formatDistance(o.distanceM)} away
                      </span>
                      <span className="rounded-full bg-[#f3f1ec] px-2.5 py-0.5 font-medium text-[#4f4b46]">
                        ✓ Community Volunteer
                      </span>
                      {o.scoreBreakdown.skill > 0.5 && (
                        <span className="rounded-full bg-[#e8effb] px-2.5 py-0.5 font-semibold text-[#1f4baa]">
                          ★ Skill Matched
                        </span>
                      )}
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
      const angle = (i / total) * Math.PI * 2 + Math.PI / 5;
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

function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return 'unknown distance';
  if (m < 1000) return `${String(Math.round(m))} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
