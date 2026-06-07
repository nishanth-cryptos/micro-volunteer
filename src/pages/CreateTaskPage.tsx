// Customer creates a task. Structured inputs (chips for category +
// skills, numeric duration, short textareas for instructions, map pin
// for location). Risk auto-derived from category; server rules enforce
// the allowed set. On submit, addDoc to tasks/{auto-id} with status=
// 'searching' and a 24-hour expiry.

import { useCallback, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const INITIAL_SEARCH_RADIUS_M = 2000;
const TASK_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_SKILLS = 5;

interface PickedLocation {
  lat: number;
  lng: number;
  h3Cell: string;
}

export default function CreateTaskPage() {
  const state = useAuthState();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [categoryKey, setCategoryKey] = useState<string>('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [meetingPoint, setMeetingPoint] = useState('');
  const [whatToBring, setWhatToBring] = useState('');
  const [preference, setPreference] = useState('');
  const [safetyNote, setSafetyNote] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const titleId = useId();
  const durationId = useId();
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

  function toggleSkill(key: string) {
    setSelectedSkills((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_SKILLS
          ? prev
          : [...prev, key],
    );
  }

  async function handleSubmit() {
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

      await addDoc(collection(db(), 'tasks'), {
        customerId: user.uid,
        title: title.trim(),
        category: selectedCategory.key,
        requiredSkills: selectedSkills,
        description,
        location,
        riskLevel: derivedRisk ?? 'low',
        estimatedMinutes,
        status: 'searching',
        searchRadiusM: INITIAL_SEARCH_RADIUS_M,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + TASK_EXPIRY_MS),
      });
      void navigate('/app', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not post the task. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Post a task</h1>
        <p className="mt-3 text-neutral-600">
          Tell us what you need help with. Stick to small, safe asks.
        </p>

        <div className="mt-10 space-y-10">
          {/* Title */}
          <Section
            label="Title"
            description="A short summary. Other people will see this first."
          >
            <input
              id={titleId}
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pick up medicine from the pharmacy"
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              aria-label="Title"
            />
          </Section>

          {/* Category */}
          <Section
            label="Category"
            description="Pick the one closest fit. This determines the risk level."
          >
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <ChipButton
                  key={c.key}
                  selected={categoryKey === c.key}
                  onClick={() => setCategoryKey(c.key)}
                >
                  {c.label}
                </ChipButton>
              ))}
            </div>
            {selectedCategory && (
              <p className="mt-3 text-sm text-neutral-600">
                {selectedCategory.description}
              </p>
            )}
            {derivedRisk && (
              <p className="mt-2 text-sm">
                <span className="text-neutral-600">Risk: </span>
                <span
                  className={
                    derivedRisk === 'medium'
                      ? 'font-medium text-amber-700'
                      : 'font-medium text-emerald-700'
                  }
                >
                  {derivedRisk === 'medium' ? 'Medium — verified ID needed' : 'Low'}
                </span>
              </p>
            )}
          </Section>

          {/* Skills */}
          <Section
            label="Skills needed"
            description={`Choose up to ${String(MAX_SKILLS)}. A volunteer matching any one is enough.`}
          >
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <ChipButton
                  key={s.key}
                  selected={selectedSkills.includes(s.key)}
                  onClick={() => toggleSkill(s.key)}
                >
                  {s.label}
                </ChipButton>
              ))}
            </div>
          </Section>

          {/* Duration */}
          <Section
            label="Estimated time"
            description="How long should this take, end to end?"
          >
            <div className="flex items-center gap-3">
              <input
                id={durationId}
                type="number"
                min={5}
                max={480}
                step={5}
                value={estimatedMinutes}
                onChange={(e) =>
                  setEstimatedMinutes(parseInt(e.target.value, 10) || 0)
                }
                aria-label="Estimated minutes"
                className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <span className="text-sm text-neutral-600">minutes</span>
            </div>
          </Section>

          {/* Location */}
          <Section
            label="Where"
            description="Drag the pin to the exact meeting point. We use this to find nearby volunteers."
          >
            <TaskLocationPicker onLocationChange={onLocationChange} />
          </Section>

          {/* Structured instructions */}
          <Section label="Instructions">
            <label
              htmlFor={meetingId}
              className="block text-sm font-medium text-neutral-900"
            >
              Meeting point details
            </label>
            <textarea
              id={meetingId}
              rows={2}
              maxLength={280}
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              placeholder="e.g. Outside Gate 2 of XYZ Apartments"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />

            <label
              htmlFor={bringId}
              className="mt-6 block text-sm font-medium text-neutral-900"
            >
              What the volunteer should bring{' '}
              <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id={bringId}
              rows={2}
              maxLength={280}
              value={whatToBring}
              onChange={(e) => setWhatToBring(e.target.value)}
              placeholder="e.g. A reusable bag"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />

            <label
              htmlFor={preferenceId}
              className="mt-6 block text-sm font-medium text-neutral-900"
            >
              Preferences{' '}
              <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id={preferenceId}
              rows={2}
              maxLength={280}
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              placeholder="e.g. Someone who knows Tamil"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />

            <label
              htmlFor={safetyId}
              className="mt-6 block text-sm font-medium text-neutral-900"
            >
              Safety note{' '}
              <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id={safetyId}
              rows={2}
              maxLength={280}
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              placeholder="e.g. Wheelchair user — slow walking pace"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </Section>
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-8 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="mt-10 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post task'}
        </button>
      </div>
    </main>
  );
}

function Section({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">{label}</h2>
      {description && (
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'rounded-full border px-4 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ' +
        (selected
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500')
      }
    >
      {children}
    </button>
  );
}
