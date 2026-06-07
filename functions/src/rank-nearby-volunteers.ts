// HTTPS callable: rank nearby volunteers for a task.
//
// Inputs:
//   { taskId: string }
//
// Returns:
//   { taskId, totalCandidates, volunteers: RankedVolunteer[] }
//
// Auth: only the task's customer may call.
//
// Matching score (from memory-bank/systemPatterns.md):
//   score = 0.30 * distance
//         + 0.25 * skill
//         + 0.20 * trust
//         + 0.15 * availability
//         + 0.10 * pastCompletion
//         - reportPenalty
//
// Scaling: M4 MVP fetches all availableNow=true users (cap 500) and
// post-filters in memory. Tracked in memory-bank/errors.md
// ("Scaling shortcut: rankNearbyVolunteers...").

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { gridDistance } from 'h3-js';

if (getApps().length === 0) {
  initializeApp();
}

const MAX_AVAILABLE_USERS_TO_FETCH = 500;
const MAX_RESULTS = 20;
const H3_DISTANCE_RING_CEILING = 15; // ~2.6 km cap on the distance score curve
const REGION = 'asia-south1';

interface TaskDoc {
  customerId: string;
  category: string;
  requiredSkills: string[];
  location: { lat: number; lng: number; h3Cell: string };
  riskLevel: 'low' | 'medium';
  searchRadiusM: number;
  status: string;
}

interface UserDoc {
  displayName?: string;
  photoURL?: string;
  roles?: string[];
  skills?: string[];
  availableNow?: boolean;
  lastKnownLocation?: { lat: number; lng: number; h3Cell: string };
  idVerified?: boolean;
  trustScore?: number;
  verifiedTaskCount?: number;
  openReportsCount?: number;
  warningsCount?: number;
  banned?: boolean;
  suspendedUntil?: Timestamp;
}

interface ScoreBreakdown {
  distance: number;
  skill: number;
  trust: number;
  availability: number;
  pastCompletion: number;
  reportPenalty: number;
  total: number;
}

interface RankedVolunteer {
  uid: string;
  displayName: string;
  photoURL: string | null;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  distanceM: number;
}

interface RankResponse {
  taskId: string;
  totalCandidates: number;
  volunteers: RankedVolunteer[];
}

export const rankNearbyVolunteers = onCall(
  { region: REGION },
  async (request): Promise<RankResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as { taskId?: unknown };
    const taskId = data.taskId;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }

    const db = getFirestore();
    const taskSnap = await db.collection('tasks').doc(taskId).get();
    if (!taskSnap.exists) {
      throw new HttpsError('not-found', 'Task not found.');
    }
    const task = taskSnap.data() as TaskDoc;
    if (task.customerId !== request.auth.uid) {
      throw new HttpsError(
        'permission-denied',
        'Only the task customer can request matching.',
      );
    }

    const availSnap = await db
      .collection('users')
      .where('availableNow', '==', true)
      .limit(MAX_AVAILABLE_USERS_TO_FETCH)
      .get();

    const candidates = availSnap.docs
      .map((d) => ({ uid: d.id, doc: d.data() as UserDoc }))
      .filter(({ uid, doc: u }) => isEligible(uid, u, task));

    const ranked = candidates
      .map(({ uid, doc: u }) => buildResult(uid, u, task))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);

    return {
      taskId,
      totalCandidates: candidates.length,
      volunteers: ranked,
    };
  },
);

function isEligible(uid: string, u: UserDoc, task: TaskDoc): boolean {
  if (uid === task.customerId) return false;
  if (u.banned === true) return false;
  if (u.suspendedUntil && u.suspendedUntil.toMillis() > Date.now()) return false;
  if (!u.roles?.includes('volunteer')) return false;
  if (!u.lastKnownLocation) return false;
  if (!u.skills || u.skills.length === 0) return false;
  // OR-mode skill match
  const overlap = u.skills.some((s) => task.requiredSkills.includes(s));
  if (!overlap) return false;
  // Medium-risk tasks require a verified ID
  if (task.riskLevel === 'medium' && !u.idVerified) return false;
  // Distance gate: must be within the task's current search radius.
  // Radius expansion (60–90s) lands in M5; for M4 we filter strictly.
  const distM = haversineM(
    u.lastKnownLocation.lat,
    u.lastKnownLocation.lng,
    task.location.lat,
    task.location.lng,
  );
  if (distM > task.searchRadiusM) return false;
  return true;
}

function buildResult(
  uid: string,
  u: UserDoc,
  task: TaskDoc,
): RankedVolunteer {
  const breakdown = score(u, task);
  const distanceM =
    u.lastKnownLocation
      ? haversineM(
          u.lastKnownLocation.lat,
          u.lastKnownLocation.lng,
          task.location.lat,
          task.location.lng,
        )
      : Number.NaN;
  return {
    uid,
    displayName: u.displayName ?? '',
    photoURL: u.photoURL ?? null,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    distanceM: Math.round(distanceM),
  };
}

function score(u: UserDoc, task: TaskDoc): ScoreBreakdown {
  const ringDist =
    u.lastKnownLocation
      ? gridDistance(task.location.h3Cell, u.lastKnownLocation.h3Cell)
      : -1;
  const distance =
    ringDist >= 0
      ? Math.max(0, 1 - ringDist / H3_DISTANCE_RING_CEILING)
      : 0;

  const matched =
    u.skills?.filter((s) => task.requiredSkills.includes(s)).length ?? 0;
  const required = task.requiredSkills.length || 1;
  const skill = matched / required;

  const trust = (u.trustScore ?? 50) / 100;

  // Available users get full availability credit in M4. Recency weighting
  // can land when we have stale-availability cleanup (M5+).
  const availability = 1;

  // 0.2 floor for new volunteers, capped at 1.
  const verified = u.verifiedTaskCount ?? 0;
  const pastCompletion = Math.min(1, 0.2 + verified * 0.05);

  const reports = u.openReportsCount ?? 0;
  const warnings = u.warningsCount ?? 0;
  const reportPenalty = Math.min(0.5, reports * 0.1 + warnings * 0.15);

  const total =
    0.30 * distance +
    0.25 * skill +
    0.20 * trust +
    0.15 * availability +
    0.10 * pastCompletion -
    reportPenalty;

  return {
    distance,
    skill,
    trust,
    availability,
    pastCompletion,
    reportPenalty,
    total,
  };
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
