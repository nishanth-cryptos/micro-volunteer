// Seed script — creates test volunteers + customers in local Firebase emulators.
// Purpose: populate Auth + Firestore with realistic users for manual testing.
// Governed by: memory-bank/systemPatterns.md (users/{uid} schema)
// Run via: npm run seed:users (from project root)

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'micro---volunteer' });

const auth = getAuth();
const db = getFirestore();

// ---------------------------------------------------------------------------
// All available skills from catalog.json
// ---------------------------------------------------------------------------
const ALL_SKILLS = [
  'read-text', 'translate-text', 'explain-forms', 'fill-forms',
  'phone-help', 'computer-help', 'online-search', 'book-appointment',
  'scan-documents', 'upload-documents', 'buy-groceries', 'fetch-medicine',
  'collect-package', 'drop-items', 'pickup-food', 'carry-bags',
  'local-errand', 'event-setup', 'registration-help', 'guide-visitors',
  'queue-support', 'distribute-materials', 'donation-sorting',
  'food-packing', 'community-cleanup',
];

function pickSkills(count) {
  const shuffled = [...ALL_SKILLS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// User definitions — simple credentials, one-word display names
// ---------------------------------------------------------------------------

const VOLUNTEERS = [
  {
    email: 'vol@example.com',
    password: 'pass123',
    displayName: 'Priya',
    bio: 'Here to help.',
    trustScore: 88,
    idVerified: true,
    verifiedTaskCount: 14,
    verifiedHours: 22,
    points: 156,
    lat: 18.6108, lng: 73.7869, // ~300 m NW of Kalewadi centre
  },
  {
    email: 'vol1@example.com',
    password: 'pass123',
    displayName: 'Ravi',
    bio: 'Weekend helper.',
    trustScore: 74,
    idVerified: false,
    verifiedTaskCount: 6,
    verifiedHours: 9,
    points: 72,
    lat: 18.6095, lng: 73.7891, // ~200 m E of centre
  },
  {
    email: 'vol2@example.com',
    password: 'pass123',
    displayName: 'Meena',
    bio: 'Happy to assist nearby.',
    trustScore: 62,
    idVerified: true,
    verifiedTaskCount: 3,
    verifiedHours: 4,
    points: 38,
    lat: 18.6118, lng: 73.7882, // ~450 m NE of centre
  },
  {
    email: 'vol3@example.com',
    password: 'pass123',
    displayName: 'Arjun',
    bio: 'New volunteer, eager to help.',
    trustScore: 42,
    idVerified: false,
    verifiedTaskCount: 1,
    verifiedHours: 1,
    points: 10,
    lat: 18.6085, lng: 73.7862, // ~550 m SW of centre
  },
];

const CUSTOMERS = [
  {
    email: 'cus@example.com',
    password: 'pass123',
    displayName: 'Sunita',
    bio: 'Needs occasional help.',
    lat: 18.6102, lng: 73.7874, // Kalewadi centre
  },
  {
    email: 'cus1@example.com',
    password: 'pass123',
    displayName: 'Deepak',
    bio: 'Busy schedule, appreciate community help.',
    lat: 18.6112, lng: 73.7855, // ~450 m NW of centre
  },
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
    const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
    if (code === 'auth/email-already-exists') {
      const record = await auth.getUserByEmail(email);
      console.log(`  ~ Exists   ${email}  (${record.uid})`);
      return record.uid;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Seed volunteers
// ---------------------------------------------------------------------------

async function seedVolunteers() {
  console.log('\n── Volunteers ──────────────────────────────────────────────');
  for (const v of VOLUNTEERS) {
    const uid = await upsertUser(v.email, v.password, v.displayName);
    const h3Cell = await latLngToH3(v.lat, v.lng);
    const skills = pickSkills(4 + Math.floor(Math.random() * 2)); // 4 or 5 skills

    const skillPoints = {};
    for (const sk of skills) {
      skillPoints[sk] = Math.max(1, Math.floor(v.verifiedTaskCount / skills.length));
    }

    await db.collection('users').doc(uid).set({
      displayName: v.displayName,
      photoURL: `users/${uid}/photo`,
      bio: v.bio,
      email: v.email,
      roles: ['volunteer', 'customer'],
      skills,
      lastKnownLocation: {
        lat: v.lat,
        lng: v.lng,
        h3Cell,
        updatedAt: new Date(),
      },
      availableNow: true,
      availabilityUpdatedAt: new Date(),
      idVerified: v.idVerified,
      trustScore: v.trustScore,
      verifiedTaskCount: v.verifiedTaskCount,
      verifiedHours: v.verifiedHours,
      points: v.points,
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
      `  ✓ Firestore  ${v.displayName.padEnd(8)} trust=${v.trustScore}  skills=[${skills.join(', ')}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// Seed customers
// ---------------------------------------------------------------------------

async function seedCustomers() {
  console.log('\n── Customers ───────────────────────────────────────────────');
  for (const c of CUSTOMERS) {
    const uid = await upsertUser(c.email, c.password, c.displayName);
    const h3Cell = await latLngToH3(c.lat, c.lng);

    await db.collection('users').doc(uid).set({
      displayName: c.displayName,
      photoURL: `users/${uid}/photo`,
      bio: c.bio,
      email: c.email,
      roles: ['customer'],
      skills: [],
      lastKnownLocation: {
        lat: c.lat,
        lng: c.lng,
        h3Cell,
        updatedAt: new Date(),
      },
      availableNow: false,
      availabilityUpdatedAt: new Date(),
      idVerified: false,
      trustScore: 30,
      verifiedTaskCount: 0,
      verifiedHours: 0,
      points: 0,
      skillPoints: {},
      openReportsCount: 0,
      warningsCount: 0,
      banned: false,
      accountStatus: 'active',
      consent: { tcVersion: 'v1-DRAFT', acceptedAt: new Date() },
      createdAt: new Date(),
      lastSeenAt: new Date(),
    });

    console.log(`  ✓ Firestore  ${c.displayName}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Seeding test users into local emulators ===');

  await seedVolunteers();
  await seedCustomers();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('Credentials:');
  console.log('');
  console.log('  Volunteers  (pass: pass123)');
  for (const v of VOLUNTEERS) {
    console.log(`    ${v.email}`);
  }
  console.log('');
  console.log('  Customers   (pass: pass123)');
  for (const c of CUSTOMERS) {
    console.log(`    ${c.email}`);
  }
  console.log('');
  console.log('  Admin       admin@example.org  /  admin123');
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
