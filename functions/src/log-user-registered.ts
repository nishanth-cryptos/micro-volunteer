// Firestore trigger that appends a `user_registered` entry to activityLog
// the first time a users/{uid} document is created (typically right after
// the user accepts T&Cs on the consent page).

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { appendActivityLog } from './activity-log';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const logUserRegistered = onDocumentCreated(
  { document: 'users/{uid}', region: REGION },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data() as { displayName?: string } | undefined;
    // displayName is usually filled in later (profile step), so on the
    // initial consent-time create we fall back to "A new user". The
    // record is still attributable via the userId field.
    const name = data?.displayName?.trim() || 'A new user';
    const db = getFirestore();
    await appendActivityLog(db, {
      eventType: 'user_registered',
      description: `${name} joined the platform`,
      userId: uid,
    });
  },
);
