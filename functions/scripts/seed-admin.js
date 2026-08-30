// Seed script — creates the test admin user(s) in local Firebase emulators.
// Admins get isAdmin: true (server-only field, cannot be set via the UI) plus
// full volunteer-shape fields so they can also test as volunteer/customer.
// Run via: npm run seed:admin (from project root)

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'micro---volunteer' });

const auth = getAuth();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Admin fixtures
// ---------------------------------------------------------------------------

// Admins cluster around the user-supplied test centre (13.0202, 77.6815)
// — Bangalore. Same centre as the seed-users fixtures so admins can also
// post / be matched against the test volunteer pool.
const ADMINS = [
  {
    email: 'admin@example.org',
    password: 'admin123',
    displayName: 'Admin User',
    bio: 'System administrator.',
    lat: 13.0205,
    lng: 77.6816, // ~30 m NE of test centre
    trustScore: 100,
    idVerified: true,
    verifiedTaskCount: 20,
    verifiedHours: 40,
    points: 200,
  },
  {
    email: 'admin2@example.org',
    password: 'admin123',
    displayName: 'Mod Two',
    bio: 'Secondary moderator.',
    lat: 13.0215,
    lng: 77.6811, // ~150 m N of test centre
    trustScore: 90,
    idVerified: true,
    verifiedTaskCount: 12,
    verifiedHours: 18,
    points: 120,
  },
];

// Static skill seed for admin docs (so they can also act as volunteers).
const ADMIN_SKILLS = [
  'read-text',
  'phone-help',
  'online-search',
  'book-appointment',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function latLngToH3(lat, lng) {
  const h3Module = await import('h3-js');
  const h3 = h3Module.default ?? h3Module;
  return h3.latLngToCell(lat, lng, 9);
}

async function upsertUser(email, password, displayName) {
  try {
    const record = await auth.createUser({ email, password, displayName });
    console.log(`  ✓ Created  ${email}  (${record.uid})`);
    return record.uid;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? err.code : '';
    if (code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      // Keep the seed idempotent: force password + displayName back to the
      // printed values so re-running the script always produces working creds.
      await auth.updateUser(existing.uid, { password, displayName });
      console.log(`  ~ Resynced ${email}  (${existing.uid})`);
      return existing.uid;
    }
    throw err;
  }
}

async function seedAdminProfile(a) {
  const uid = await upsertUser(a.email, a.password, a.displayName);
  const h3Cell = await latLngToH3(a.lat, a.lng);

  const skillPoints = {};
  for (const sk of ADMIN_SKILLS) {
    skillPoints[sk] = Math.max(
      1,
      Math.floor(a.verifiedTaskCount / Math.max(1, ADMIN_SKILLS.length)),
    );
  }

  await db
    .collection('users')
    .doc(uid)
    .set({
      displayName: a.displayName,
      photoURL: `users/${uid}/photo`,
      bio: a.bio,
      email: a.email,
      roles: ['admin', 'volunteer', 'customer'],
      isAdmin: true,
      skills: ADMIN_SKILLS,
      lastKnownLocation: {
        lat: a.lat,
        lng: a.lng,
        h3Cell,
        updatedAt: new Date(),
      },
      availableNow: false, // admins start offline; toggle on in UI if needed
      availabilityUpdatedAt: new Date(),
      idVerified: a.idVerified,
      trustScore: a.trustScore,
      verifiedTaskCount: a.verifiedTaskCount,
      verifiedHours: a.verifiedHours,
      points: a.points,
      skillPoints,
      openReportsCount: 0,
      warningsCount: 0,
      banned: false,
      accountStatus: 'active',
      consent: { tcVersion: 'v1-DRAFT', acceptedAt: new Date() },
      createdAt: new Date(),
      lastSeenAt: new Date(),
    });

  console.log(
    `  ✓ Firestore  ${a.displayName.padEnd(10)} roles=[admin, volunteer, customer]  isAdmin=true`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Seeding admin users into local emulators ===');
  console.log('\n── Admins ──────────────────────────────────────────────────');

  for (const a of ADMINS) {
    await seedAdminProfile(a);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('Admin Credentials:');
  for (const a of ADMINS) {
    console.log(`  ${a.email.padEnd(22)} / ${a.password}   (${a.displayName})`);
  }
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
