// Firebase client SDK init + lazy service accessors with emulator wiring.
// Governs: memory-bank/systemPatterns.md (server-authoritative model) and
// memory-bank/techContext.md (env var contract).
// Responsibilities:
//   - Build a single FirebaseApp from VITE_FIREBASE_* env vars.
//   - Lazily return typed Auth / Firestore / Storage / Functions instances.
//   - When VITE_USE_EMULATORS === '1', connect each service to its local
//     emulator exactly once, on first access.
// NEVER log config values, env vars, OTPs, auth tokens, or PII from this file.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';


const FUNCTIONS_REGION = 'asia-south1';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  storage: 9199,
  functions: 5001,
} as const;

const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;
let cachedFunctions: Functions | null = null;

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

export function auth(): Auth {
  if (cachedAuth) return cachedAuth;
  const instance = getAuth(getFirebaseApp());
  if (useEmulators) {
    connectAuthEmulator(
      instance,
      `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`,
      { disableWarnings: true },
    );
  }
  cachedAuth = instance;
  return instance;
}

export function db(): Firestore {
  if (cachedDb) return cachedDb;
  const instance = getFirestore(getFirebaseApp());
  if (useEmulators) {
    connectFirestoreEmulator(instance, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  }
  cachedDb = instance;
  return instance;
}

export function storage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;
  const instance = getStorage(getFirebaseApp());
  if (useEmulators) {
    connectStorageEmulator(instance, EMULATOR_HOST, EMULATOR_PORTS.storage);
  }
  cachedStorage = instance;
  return instance;
}

let cachedAppCheck: AppCheck | null = null;

export function appCheck(): AppCheck | null {
  if (cachedAppCheck) return cachedAppCheck;
  if (typeof window === 'undefined') return null;

  if (useEmulators) {
    // @ts-expect-error App Check debug token global initialization for emulator mode
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const rawKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  const siteKey = typeof rawKey === 'string' ? rawKey : '';

  if (!siteKey && !useEmulators) return null;

  try {
    cachedAppCheck = initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaEnterpriseProvider(
        siteKey.length > 0 ? siteKey : '6Ld_debug_token_site_key_placeholder',
      ),
      isTokenAutoRefreshEnabled: true,
    });
    return cachedAppCheck;
  } catch {
    return null;
  }

}

export function functions(): Functions {
  if (cachedFunctions) return cachedFunctions;
  const instance = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
  if (useEmulators) {
    connectFunctionsEmulator(instance, EMULATOR_HOST, EMULATOR_PORTS.functions);
  }
  cachedFunctions = instance;
  return instance;
}

