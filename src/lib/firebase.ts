// Firebase client SDK initialization (lazy).
// Governs: memory-bank/systemPatterns.md (PII handling, server-authoritative model).
// Responsibilities: build a single FirebaseApp instance from VITE_FIREBASE_* env vars.
// Does NOT export Firestore/Auth/Storage helpers yet — those land in M1+ with
// proper typed wrappers. NEVER log config values or PII from this file.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

let cachedApp: FirebaseApp | null = null;

function readConfig() {
  const env = import.meta.env;
  const required = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Firebase config incomplete — missing env vars: ${missing.join(', ')}. ` +
        `Copy .env.example to .env.local and fill from Firebase Console.`,
    );
  }
  const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;
  return measurementId ? { ...required, measurementId } : required;
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  cachedApp = initializeApp(readConfig());
  return cachedApp;
}
