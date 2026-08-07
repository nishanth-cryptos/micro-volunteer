// Module 5 & 6 — Isolated Trail Datastore, Consent, and Self-Serve Erasure (DPDP Act Compliance)
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  TRAIL_CONSTANTS,
  type CanonicalRoute,
  type DepartureEvent,
  type TrailConsent,
} from './types';

const TRAIL_COLLECTION = 'user_trails';
const CONSENT_KEY_PREFIX = 'padosi_trail_consent_';

// Verification helper for AuthZ ownership checks
function verifyVolunteerOwnership(volunteerId: string): void {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('TrailService: Unauthorized - User must be signed in');
  }
  if (currentUser.uid !== volunteerId) {
    throw new Error('TrailService: Forbidden - Cannot access another user\'s trail data');
  }
}

// 1. Consent Management (DPDP Act Alignment)
export function getLocalTrailConsent(volunteerId: string): boolean {
  try {
    const raw = localStorage.getItem(`${CONSENT_KEY_PREFIX}${volunteerId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as TrailConsent;
    return parsed.trailConsentGiven ?? false;
  } catch {
    return false;
  }
}

export async function setTrailConsent(
  volunteerId: string,
  consentGiven: boolean,
): Promise<void> {
  verifyVolunteerOwnership(volunteerId);

  const consent: TrailConsent = {
    volunteerId,
    trailConsentGiven: consentGiven,
    consentTimestamp: Date.now(),
    retentionDays: TRAIL_CONSTANTS.DEFAULT_RETENTION_DAYS,
  };

  localStorage.setItem(
    `${CONSENT_KEY_PREFIX}${volunteerId}`,
    JSON.stringify(consent),
  );

  const consentRef = doc(db(), TRAIL_COLLECTION, volunteerId);
  await setDoc(consentRef, { consent }, { merge: true });

  if (!consentGiven) {
    // If consent revoked, trigger wipe of all inferred routes & trip data
    await wipeAllTrailData(volunteerId);
  }
}

// 2. Canonical Routes Datastore Operations
export async function getCanonicalRoutes(
  volunteerId: string,
): Promise<CanonicalRoute[]> {
  verifyVolunteerOwnership(volunteerId);

  if (!getLocalTrailConsent(volunteerId)) {
    return [];
  }

  try {
    const routesRef = collection(db(), TRAIL_COLLECTION, volunteerId, 'routes');
    const snap = await getDocs(routesRef);
    return snap.docs.map((d) => d.data() as CanonicalRoute);
  } catch (err) {
    console.warn('TrailService: Failed to fetch canonical routes from Firestore', err);
    return [];
  }
}

export async function saveCanonicalRoute(
  volunteerId: string,
  route: CanonicalRoute,
): Promise<void> {
  verifyVolunteerOwnership(volunteerId);

  if (!getLocalTrailConsent(volunteerId)) return;

  const routeRef = doc(db(), TRAIL_COLLECTION, volunteerId, 'routes', route.id);
  await setDoc(routeRef, route, { merge: true });
}

export async function recordDepartureEvent(
  volunteerId: string,
  event: DepartureEvent,
): Promise<void> {
  verifyVolunteerOwnership(volunteerId);

  if (!getLocalTrailConsent(volunteerId)) return;

  const eventRef = doc(db(), TRAIL_COLLECTION, volunteerId, 'events', event.id);
  await setDoc(eventRef, event, { merge: true });
}

// 3. Self-Serve Access & Deletion Rights (DPDP Act Compliance)
export async function deleteCanonicalRoute(
  volunteerId: string,
  routeId: string,
): Promise<void> {
  verifyVolunteerOwnership(volunteerId);

  const routeRef = doc(db(), TRAIL_COLLECTION, volunteerId, 'routes', routeId);
  await deleteDoc(routeRef);
}

export async function wipeAllTrailData(volunteerId: string): Promise<void> {
  verifyVolunteerOwnership(volunteerId);

  try {
    // Delete all routes
    const routesRef = collection(db(), TRAIL_COLLECTION, volunteerId, 'routes');
    const routesSnap = await getDocs(routesRef);
    for (const d of routesSnap.docs) {
      await deleteDoc(d.ref);
    }

    // Delete all events
    const eventsRef = collection(db(), TRAIL_COLLECTION, volunteerId, 'events');
    const eventsSnap = await getDocs(eventsRef);
    for (const d of eventsSnap.docs) {
      await deleteDoc(d.ref);
    }

    // Clear local storage consent & cached pings
    localStorage.removeItem(`${CONSENT_KEY_PREFIX}${volunteerId}`);

    // Update parent doc
    const parentRef = doc(db(), TRAIL_COLLECTION, volunteerId);
    await setDoc(parentRef, { consent: null, wipedAt: Date.now() });
  } catch (err) {
    console.error('TrailService: Error wiping trail data', err);
  }
}
