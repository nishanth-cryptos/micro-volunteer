// Customer view of a posted task + ranked list of nearby volunteers.
// Fetches the task document (rules: customer-only read), then calls the
// rankNearbyVolunteers callable. Live status updates land in M5.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuthState } from '../lib/auth-context';
import { getCategory, getSkillLabel } from '../lib/catalog';

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
  status: string;
  searchRadiusM: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

interface RankedVolunteer {
  uid: string;
  displayName: string;
  photoURL: string | null;
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
}

interface RankResponse {
  taskId: string;
  totalCandidates: number;
  volunteers: RankedVolunteer[];
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const state = useAuthState();
  const [task, setTask] = useState<TaskDoc | null>(null);
  const [ranking, setRanking] = useState<RankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId || state.status !== 'ready') return;
    let cancelled = false;
    async function load() {
      try {
        const taskSnap = await getDoc(doc(db(), 'tasks', taskId!));
        if (cancelled) return;
        if (!taskSnap.exists()) {
          setError('Task not found.');
          setLoading(false);
          return;
        }
        setTask(taskSnap.data() as TaskDoc);
        const rankFn = httpsCallable<{ taskId: string }, RankResponse>(
          functions(),
          'rankNearbyVolunteers',
        );
        const result = await rankFn({ taskId: taskId! });
        if (cancelled) return;
        setRanking(result.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load this task.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [taskId, state.status]);

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
        {ranking && <RankingList ranking={ranking} />}
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

function RankingList({ ranking }: { ranking: RankResponse }) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-neutral-900">
        Nearby volunteers
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        {ranking.totalCandidates === 0
          ? 'No matching volunteers right now. M5 adds push offers when one becomes available.'
          : `Showing ${String(ranking.volunteers.length)} of ${String(ranking.totalCandidates)} eligible volunteers.`}
      </p>
      {ranking.volunteers.length > 0 && (
        <ul className="mt-6 space-y-3">
          {ranking.volunteers.map((v) => (
            <li
              key={v.uid}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-medium text-neutral-700">
                  {(v.displayName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">
                    {v.displayName || 'Unnamed volunteer'}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {formatDistance(v.distanceM)} away · score {v.score.toFixed(2)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <ScoreChip label="Dist" value={v.scoreBreakdown.distance} />
                    <ScoreChip label="Skill" value={v.scoreBreakdown.skill} />
                    <ScoreChip label="Trust" value={v.scoreBreakdown.trust} />
                    <ScoreChip
                      label="Past"
                      value={v.scoreBreakdown.pastCompletion}
                    />
                    {v.scoreBreakdown.reportPenalty > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                        − Reports {v.scoreBreakdown.reportPenalty.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
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
