// Customer creates a task. Structured inputs (chips for category +
// skills, time stepper for duration, short textareas for instructions,
// map pin for location). Risk auto-derived from category; server rules
// enforce the allowed set. On submit, addDoc to tasks/{auto-id} with
// status='searching' and a 24-hour expiry.
// Visual theme + animations ported from Claude Design handoff bundle
// (Volunteer Dashboard.html, 2026-06-14). Form fields + Firestore write
// logic preserved verbatim; only the chrome/styling changed.

import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Timestamp,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import {
  CATEGORIES,
  SKILLS,
  deriveRisk,
  type Category,
} from '../lib/catalog';
import { TaskLocationPicker } from '../components/TaskLocationPicker';
import { ScheduleTaskBottomSheet } from '../components/ScheduleTaskBottomSheet';


const INITIAL_SEARCH_RADIUS_M = 2000;
const TASK_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_SKILLS = 5;
const DURATION_PRESETS = [15, 30, 60, 120];

interface PickedLocation {
  lat: number;
  lng: number;
  h3Cell: string;
}

export default function CreateTaskPage() {
  const state = useAuthState();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const prefill = (routerLocation.state as {
    prefill?: {
      title?: string;
      category?: string;
      requiredSkills?: string[];
      estimatedMinutes?: number;
      description?: {
        meetingPoint?: string;
        whatToBring?: string;
        preference?: string;
        safetyNote?: string;
      };
      location?: PickedLocation;
      expectedWaitTier?: 'fast' | 'normal' | 'flexible';
    };
  } | null)?.prefill;

  const [title, setTitle] = useState(() => prefill?.title ?? '');
  const [categoryKey, setCategoryKey] = useState<string>(() => prefill?.category ?? '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() => prefill?.requiredSkills ?? []);
  const [estimatedMinutes, setEstimatedMinutes] = useState(() => prefill?.estimatedMinutes ?? 30);
  const [meetingPoint, setMeetingPoint] = useState(() => prefill?.description?.meetingPoint ?? '');
  const [whatToBring, setWhatToBring] = useState(() => prefill?.description?.whatToBring ?? '');
  const [preference, setPreference] = useState(() => prefill?.description?.preference ?? '');
  const [safetyNote, setSafetyNote] = useState(() => prefill?.description?.safetyNote ?? '');
  const [location, setLocation] = useState<PickedLocation | null>(() => prefill?.location ?? null);
  const [expectedWaitTier, setExpectedWaitTier] = useState<'fast' | 'normal' | 'flexible'>(() => prefill?.expectedWaitTier ?? 'normal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false);
  const [scheduledSuccessInfo, setScheduledSuccessInfo] = useState<{
    taskId: string;
    scheduledForMs: number;
  } | null>(null);

  const titleId = useId();
  const meetingId = useId();
  const bringId = useId();
  const preferenceId = useId();
  const safetyId = useId();
  const errorId = useId();

  const onLocationChange = useCallback((loc: PickedLocation) => {
    setLocation(loc);
  }, []);

  // Role gate: only customers (or both) may post a task. Other authenticated
  // users get bounced to /app — they shouldn't have reached the URL anyway.
  if (state.status !== 'ready') return null;
  const { user, userDoc } = state;
  const isCustomer = userDoc.roles?.includes('customer') ?? false;
  if (!isCustomer) {
    void navigate('/app', { replace: true });
    return null;
  }

  const selectedCategory: Category | undefined = CATEGORIES.find(
    (c) => c.key === categoryKey,
  );
  const derivedRisk = selectedCategory ? deriveRisk(selectedCategory.key) : null;

  // 6 required fields drive the progress strip — title, category, ≥1 skill,
  // valid duration, meeting point, location pin. Optional textareas don't
  // count against progress so the user isn't pushed to fill them.
  const filledRequired =
    (title.trim() ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedSkills.length > 0 ? 1 : 0) +
    (estimatedMinutes >= 5 && estimatedMinutes <= 480 ? 1 : 0) +
    (meetingPoint.trim() ? 1 : 0) +
    (location ? 1 : 0);
  const canPost = filledRequired === 6 && !busy;

  function toggleSkill(key: string) {
    setSelectedSkills((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_SKILLS
          ? prev
          : [...prev, key],
    );
  }

  function bumpDuration(delta: number) {
    setEstimatedMinutes((m) =>
      Math.max(5, Math.min(480, Math.round((m + delta) / 5) * 5)),
    );
  }

  async function handleSubmit(scheduledForMs?: number) {
    setError(null);
    if (!title.trim()) return setError('Add a short title.');
    if (!selectedCategory) return setError('Pick a category.');
    if (selectedSkills.length === 0) {
      return setError('Pick at least one skill needed.');
    }
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 480) {
      return setError('Duration must be between 5 and 480 minutes.');
    }
    if (!meetingPoint.trim()) {
      return setError('Describe where you’ll meet the volunteer.');
    }
    if (!location) return setError('Pick a location on the map.');

    setBusy(true);

    try {
      const description: Record<string, string> = {
        meetingPoint: meetingPoint.trim(),
        whatToBring: whatToBring.trim(),
      };

      if (preference.trim()) description.preference = preference.trim();
      if (safetyNote.trim()) description.safetyNote = safetyNote.trim();

      const isScheduled = typeof scheduledForMs === 'number';

      const taskData: Record<string, unknown> = {
        customerId: user.uid,
        customerName: userDoc.displayName || 'Customer',
        title: title.trim(),
        category: selectedCategory.key,
        requiredSkills: selectedSkills,
        description,
        location,
        riskLevel: derivedRisk ?? 'low',
        estimatedMinutes,
        status: isScheduled ? 'scheduled' : 'searching',
        searchRadiusM: INITIAL_SEARCH_RADIUS_M,
        expectedWaitTier,
        createdAt: serverTimestamp(),
      };

      if (isScheduled) {
        taskData.scheduledFor = Timestamp.fromMillis(scheduledForMs);
        taskData.scheduledCreatedAt = serverTimestamp();
      } else {
        taskData.waitStartedAt = serverTimestamp();
        taskData.nextCheckAt = Timestamp.fromMillis(Date.now() + 60 * 1000);
        taskData.expiresAt = Timestamp.fromMillis(Date.now() + TASK_EXPIRY_MS);
      }

      if (userDoc.photoURL) {
        taskData.customerPhotoURL = userDoc.photoURL;
      }

      const created = await addDoc(collection(db(), 'tasks'), taskData);

      if (isScheduled) {
        setScheduledSuccessInfo({
          taskId: created.id,
          scheduledForMs,
        });
      } else {
        void navigate(`/tasks/${created.id}`, { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not post the task. Try again.',
      );
    } finally {
      setBusy(false);
      setIsScheduleSheetOpen(false);
    }
  }

  if (scheduledSuccessInfo) {
    const formattedTime = new Date(
      scheduledSuccessInfo.scheduledForMs,
    ).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#131312] grid place-items-center p-6">
        <div className="vc-fade-up w-full max-w-md rounded-3xl border border-[#ececea] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#e3efe9] text-[#1f6f5c]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#131312]">
            Task scheduled successfully
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#4f4b46]">
            We&apos;ll start reaching out to neighbors on{' '}
            <span className="font-semibold text-[#1f6f5c]">{formattedTime}</span>.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/app?tab=scheduled"
              className="w-full rounded-full bg-[#1f6f5c] py-3 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none shadow-md"
            >
              View scheduled tasks
            </Link>
            <Link
              to="/app"
              className="w-full rounded-full border border-[#ececea] bg-white py-3 text-sm font-semibold text-[#4f4b46] transition hover:bg-[#f3f1ec] focus:outline-none"
            >
              Done
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <div className="sticky top-0 z-30 border-b border-[#ececea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ececea] px-3 py-1.5 text-[12px] font-medium text-[#4f4b46] transition hover:border-[#d8d4cc] hover:bg-[#f3f1ec]"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold text-[#131312]">
              Need a hand?
            </h1>
            <p className="truncate text-[12px] text-[#8a847d]">
              Describe what you need — local volunteers respond fast.
            </p>
          </div>
        </div>
      </div>

      <ContentBody
        title={title}

        setTitle={setTitle}
        titleId={titleId}
        categoryKey={categoryKey}
        setCategoryKey={setCategoryKey}
        selectedCategory={selectedCategory}
        derivedRisk={derivedRisk}
        selectedSkills={selectedSkills}
        toggleSkill={toggleSkill}
        estimatedMinutes={estimatedMinutes}
        setEstimatedMinutes={setEstimatedMinutes}
        bumpDuration={bumpDuration}
        meetingPoint={meetingPoint}
        setMeetingPoint={setMeetingPoint}
        meetingId={meetingId}
        whatToBring={whatToBring}
        setWhatToBring={setWhatToBring}
        bringId={bringId}
        preference={preference}
        setPreference={setPreference}
        preferenceId={preferenceId}
        safetyNote={safetyNote}
        setSafetyNote={setSafetyNote}
        safetyId={safetyId}
        onLocationChange={onLocationChange}
        location={location}
        expectedWaitTier={expectedWaitTier}
        setExpectedWaitTier={setExpectedWaitTier}
        error={error}
        errorId={errorId}
      />

      <div
        className={
          'fixed inset-x-0 bottom-0 z-30 border-t border-[#ececea] bg-white/95 backdrop-blur transition-all duration-300 ease-out ' +
          (filledRequired > 0
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-full opacity-0')
        }
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[#131312]">
              {canPost
                ? 'Your task is ready to post'
                : `${String(filledRequired)} of 6 fields filled`}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[#8a847d]">
              {selectedCategory?.label ?? 'Pick a category'}
              {' · '}
              {estimatedMinutes} min
              {selectedSkills.length > 0 && (
                <>
                  {' · '}
                  {selectedSkills.length}{' '}
                  {selectedSkills.length === 1 ? 'skill' : 'skills'}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsScheduleSheetOpen(true)}
              disabled={!canPost || busy}
              className={
                'rounded-full border px-4 py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
                (canPost
                  ? 'border-[#1f6f5c] text-[#1f6f5c] hover:bg-[#e3efe9]/50 focus-visible:ring-[#1f6f5c]'
                  : 'cursor-not-allowed border-[#ececea] text-[#b8b3ad]')
              }
            >
              Schedule for later
            </button>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canPost || busy}
              className={
                'rounded-full px-5 py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
                (canPost
                  ? 'bg-gradient-to-r from-[#1f6f5c] to-[#185845] text-white shadow-[0_8px_20px_-8px_rgba(31,111,92,0.55)] hover:from-[#1d6655] hover:to-[#14503e] focus-visible:ring-[#1f6f5c]'
                  : 'cursor-not-allowed bg-[#ececea] text-[#8a847d]')
              }
            >
              {busy ? 'Posting…' : 'Post task'}
            </button>
          </div>
        </div>
      </div>

      <ScheduleTaskBottomSheet
        isOpen={isScheduleSheetOpen}
        onClose={() => setIsScheduleSheetOpen(false)}
        onConfirm={(scheduledForMs) => void handleSubmit(scheduledForMs)}
        isSubmitting={busy}
      />
    </main>
  );
}

const WAIT_TIER_PRESETS: Array<{

  key: 'fast' | 'normal' | 'flexible';
  label: string;
  subtext: string;
}> = [

  {
    key: 'fast',
    label: 'I need this soon',
    subtext: 'Best for urgent tasks · Escalates search within 3–15 mins',
  },
  {
    key: 'normal',
    label: 'Whenever works',
    subtext: 'Standard matching pace · Escalates search within 5–30 mins',
  },
  {
    key: 'flexible',
    label: 'No rush',
    subtext: 'No hurry needed · Escalates search over 10–60 mins',
  },
];

interface BodyProps {
  title: string;
  setTitle: (v: string) => void;
  titleId: string;
  categoryKey: string;
  setCategoryKey: (v: string) => void;
  selectedCategory: Category | undefined;
  derivedRisk: 'low' | 'medium' | null;
  selectedSkills: string[];
  toggleSkill: (k: string) => void;
  estimatedMinutes: number;
  setEstimatedMinutes: (n: number) => void;
  bumpDuration: (delta: number) => void;
  meetingPoint: string;
  setMeetingPoint: (v: string) => void;
  meetingId: string;
  whatToBring: string;
  setWhatToBring: (v: string) => void;
  bringId: string;
  preference: string;
  setPreference: (v: string) => void;
  preferenceId: string;
  safetyNote: string;
  setSafetyNote: (v: string) => void;
  safetyId: string;
  onLocationChange: (loc: PickedLocation) => void;
  location: PickedLocation | null;
  expectedWaitTier: 'fast' | 'normal' | 'flexible';
  setExpectedWaitTier: (tier: 'fast' | 'normal' | 'flexible') => void;
  error: string | null;
  errorId: string;
}


function ContentBody(p: BodyProps) {
  const skillsAtCap = p.selectedSkills.length >= MAX_SKILLS;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-10 pb-40">
      <div className="vc-fade-up">
        <h1 className="text-[32px] font-bold tracking-tight">Post a task</h1>
        <p className="mt-2 text-sm text-[#4f4b46]">
          Tell us what you need help with. Stick to small, safe asks.
        </p>
      </div>

      <div className="mt-9 space-y-9">
        <FormBlock label="Title" hint="A short summary nearby volunteers will see first.">
          <div className="relative">
            <input
              id={p.titleId}
              type="text"
              maxLength={80}
              value={p.title}
              onChange={(e) => p.setTitle(e.target.value)}
              placeholder="e.g. Pick up medicine from the pharmacy"
              className="w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-[15px] text-[#131312] placeholder-[#b8b3ad] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-4 focus:ring-[#1f6f5c]/10"
              aria-label="Title"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#8a847d]">
              {p.title.length} / 80
            </span>
          </div>
        </FormBlock>

        <FormBlock label="Category" hint="Pick the closest fit. This sets the risk level.">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.key}
                on={p.categoryKey === c.key}
                onClick={() => p.setCategoryKey(c.key)}
                label={c.label}
              />
            ))}
          </div>
          {p.selectedCategory && (
            <p className="vc-fade-in mt-3 text-sm text-[#4f4b46]">
              {p.selectedCategory.description}
            </p>
          )}
          {p.derivedRisk && (
            <div className="vc-fade-in mt-3 rounded-xl border border-[#ececea] bg-white p-3.5 text-xs leading-relaxed shadow-xs">
              {p.derivedRisk === 'medium' ? (
                <div className="flex items-start gap-2 text-[#854d0e]">
                  <span className="text-base">🛡️</span>
                  <span>
                    <strong className="font-semibold text-[#713f12]">Verified Volunteer Category:</strong> For safety in this category, only volunteers who have completed identity verification can accept your task.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[#1f6f5c]">
                  <span className="text-base">✓</span>
                  <span>
                    <strong className="font-semibold text-[#185845]">Low-Risk Community Task:</strong> Open to all helpful, registered neighbourhood volunteers.
                  </span>
                </div>
              )}
            </div>
          )}
        </FormBlock>

        <FormBlock
          label="Skills needed"
          hint={`Choose up to ${String(MAX_SKILLS)}. A volunteer matching any one is enough.`}
          extra={
            <span className="rounded-full bg-[#f3f1ec] px-2.5 py-0.5 font-mono text-[11px] text-[#4f4b46]">
              {p.selectedSkills.length} / {MAX_SKILLS}
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => {
              const on = p.selectedSkills.includes(s.key);
              const disabled = !on && skillsAtCap;
              return (
                <Chip
                  key={s.key}
                  on={on}
                  disabled={disabled}
                  onClick={() => p.toggleSkill(s.key)}
                  label={s.label}
                />
              );
            })}
          </div>
        </FormBlock>

        <FormBlock label="Estimated time" hint="How long, end to end?">
          <TimeStepper
            value={p.estimatedMinutes}
            onChange={p.setEstimatedMinutes}
            onBump={p.bumpDuration}
          />
        </FormBlock>

        <FormBlock
          label="How soon do you need help?"
          hint="Select your wait-time expectation preset."
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {WAIT_TIER_PRESETS.map((preset) => {
              const on = p.expectedWaitTier === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => p.setExpectedWaitTier(preset.key)}
                  aria-pressed={on}
                  className={
                    'flex flex-col justify-between rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 ' +
                    (on
                      ? 'border-[#1f6f5c] bg-[#e3efe9]/50 shadow-sm'
                      : 'border-[#ececea] bg-white hover:border-[#d8d4cc]')
                  }
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold text-[#131312]">
                        {preset.label}
                      </span>
                      {on && (
                        <span className="vc-check-pop grid h-5 w-5 place-items-center rounded-full bg-[#1f6f5c] text-white">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[#4f4b46]">
                      {preset.subtext}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </FormBlock>

        <FormBlock label="Where" hint="Drag the pin to the exact meeting point.">
          <TaskLocationPicker onLocationChange={p.onLocationChange} />
        </FormBlock>


        <FormBlock label="Instructions">
          <FieldTextarea
            id={p.meetingId}
            label="Meeting point details"
            value={p.meetingPoint}
            onChange={p.setMeetingPoint}
            placeholder="e.g. Outside Main Gate of XYZ Society, near the security desk"
            helper="Tip: For safety, choose a visible, familiar, or public spot (e.g. society gate, lobby, nearby landmark)."
          />
          <FieldTextarea
            id={p.bringId}
            label="What the volunteer should bring"
            optional
            value={p.whatToBring}
            onChange={p.setWhatToBring}
            placeholder="e.g. A reusable bag"
          />
          <FieldTextarea
            id={p.preferenceId}
            label="Preferences"
            optional
            value={p.preference}
            onChange={p.setPreference}
            placeholder="e.g. Someone who knows Tamil"
          />
          <FieldTextarea
            id={p.safetyId}
            label="Safety note"
            optional
            value={p.safetyNote}
            onChange={p.setSafetyNote}
            placeholder="e.g. Wheelchair user — slow walking pace"
          />
        </FormBlock>
      </div>

      {p.error && (
        <p
          id={p.errorId}
          role="alert"
          className="vc-fade-in mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {p.error}
        </p>
      )}
    </div>
  );
}

function FormBlock({
  label,
  hint,
  extra,
  children,
}: {
  label: string;
  hint?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="vc-fade-up">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#131312]">{label}</h3>
          {hint && <p className="mt-0.5 text-[12px] text-[#8a847d]">{hint}</p>}
        </div>
        {extra}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Chip({
  on,
  disabled = false,
  onClick,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className={
        'vc-chip inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 ' +
        (on
          ? 'is-on border-[#1f6f5c] bg-[#1f6f5c] text-white shadow-[0_6px_14px_-8px_rgba(31,111,92,0.55)]'
          : disabled
            ? 'cursor-not-allowed border-[#ececea] bg-[#f7f5f0] text-[#b8b3ad]'
            : 'border-[#ececea] bg-white text-[#4f4b46] hover:border-[#1f6f5c] hover:text-[#131312]')
      }
    >
      {on && (
        <span className="vc-check-pop inline-flex">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}
      {label}
    </button>
  );
}

function TimeStepper({
  value,
  onChange,
  onBump,
}: {
  value: number;
  onChange: (n: number) => void;
  onBump: (delta: number) => void;
}) {
  // Pulse the number on change without rerendering layout.
  const pulseKey = useMemo(() => value, [value]);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="inline-flex items-center gap-2 rounded-2xl border border-[#ececea] bg-white p-1.5">
        <button
          type="button"
          aria-label="Decrease 5 minutes"
          onClick={() => onBump(-5)}
          className="grid h-9 w-9 place-items-center rounded-xl text-[18px] text-[#4f4b46] transition hover:bg-[#f3f1ec] active:scale-95"
        >
          −
        </button>
        <div className="min-w-[80px] text-center">
          <span
            key={pulseKey}
            className="vc-fade-up inline-block font-mono text-[22px] font-semibold tracking-tight text-[#131312]"
          >
            {value}
          </span>
          <span className="ml-1 text-[12px] text-[#8a847d]">min</span>
        </div>
        <button
          type="button"
          aria-label="Increase 5 minutes"
          onClick={() => onBump(5)}
          className="grid h-9 w-9 place-items-center rounded-xl text-[18px] text-[#4f4b46] transition hover:bg-[#f3f1ec] active:scale-95"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((p) => {
          const on = value === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-pressed={on}
              className={
                'vc-chip rounded-full border px-3 py-1.5 text-[12px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 ' +
                (on
                  ? 'is-on border-[#1f6f5c] bg-[#e3efe9] text-[#1f6f5c]'
                  : 'border-[#ececea] bg-white text-[#4f4b46] hover:border-[#1f6f5c] hover:text-[#131312]')
              }
            >
              {p < 60 ? `${String(p)}m` : `${String(p / 60)}h`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  optional = false,
  value,
  onChange,
  placeholder,
  helper,
}: {
  id: string;
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helper?: string;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <label htmlFor={id} className="block text-[13px] font-medium text-[#131312]">
          {label}{' '}
          {optional && (
            <span className="font-normal text-[#8a847d]">(optional)</span>
          )}
        </label>
      </div>
      {helper && (
        <p className="mt-0.5 text-xs text-[#8a847d]">{helper}</p>
      )}
      <textarea
        id={id}
        rows={2}
        maxLength={280}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full resize-y rounded-xl border border-[#ececea] bg-white px-4 py-3 text-[14px] text-[#131312] placeholder-[#b8b3ad] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-4 focus:ring-[#1f6f5c]/10"
      />
    </div>
  );
}
