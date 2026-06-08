// Seed script — creates test users in local Firebase emulators.
// Composition (governed by: memory-bank/systemPatterns.md users/{uid} schema):
//   3 volunteer-only   — roles: ['volunteer'],            available, with skills + trust history
//   3 customer-only    — roles: ['customer'],             no skills, can post tasks
//   3 dual role        — roles: ['volunteer','customer'], full volunteer fields, can also post + earn 2pt customer reward
//   (2 admins live in seed-admin.js)
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
// Fixture sets
// ---------------------------------------------------------------------------

const VOLUNTEERS_ONLY = [
  {
    email: 'vol@example.com',
    password: 'pass123',
    displayName: 'Priya',
    bio: 'Here to help.',
    trustScore: 88, idVerified: true,
    verifiedTaskCount: 14, verifiedHours: 22, points: 156,
    lat: 18.6108, lng: 73.7869, // ~300 m NW of Kalewadi centre
  },
  {
    email: 'vol1@example.com',
    password: 'pass123',
    displayName: 'Ravi',
    bio: 'Weekend helper.',
    trustScore: 74, idVerified: false,
    verifiedTaskCount: 6, verifiedHours: 9, points: 72,
    lat: 18.6095, lng: 73.7891, // ~200 m E of centre
  },
  {
    email: 'vol2@example.com',
    password: 'pass123',
    displayName: 'Arjun',
    bio: 'New volunteer, eager to help.',
    trustScore: 42, idVerified: false,
    verifiedTaskCount: 1, verifiedHours: 1, points: 10,
    lat: 18.6085, lng: 73.7862, // ~550 m SW of centre
  },
];

const CUSTOMERS_ONLY = [
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
  {
    email: 'cus2@example.com',
    password: 'pass123',
    displayName: 'Rekha',
    bio: 'Looking for trusted help in my area.',
    lat: 18.6120, lng: 73.7900, // ~450 m NE of centre
  },
];

const BOTH = [
  {
    email: 'both@example.com',
    password: 'pass123',
    displayName: 'Meena',
    bio: 'Happy to assist nearby. Also posts tasks.',
    trustScore: 62, idVerified: true,
    verifiedTaskCount: 3, verifiedHours: 4, points: 38,
    lat: 18.6118, lng: 73.7882, // ~450 m NE of centre
  },
  {
    email: 'both1@example.com',
    password: 'pass123',
    displayName: 'Anil',
    bio: 'Both helps and asks for help in the community.',
    trustScore: 80, idVerified: true,
    verifiedTaskCount: 10, verifiedHours: 14, points: 100,
    lat: 18.6100, lng: 73.7900, // ~250 m E of centre
  },
  {
    email: 'both2@example.com',
    password: 'pass123',
    displayName: 'Kavita',
    bio: 'New to the platform — happy to help when free.',
    trustScore: 55, idVerified: false,
    verifiedTaskCount: 2, verifiedHours: 3, points: 25,
    lat: 18.6080, lng: 73.7890, // ~550 m S of centre
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
      const existing = await auth.getUserByEmail(email);
      // Re-sync password + displayName so the seed stays idempotent. Without
      // this, an account that pre-existed in the emulator (e.g. created via
      // UI signup) keeps its old password and the printed credentials below
      // don't actually work.
      await auth.updateUser(existing.uid, { password, displayName });
      console.log(`  ~ Resynced ${email}  (${existing.uid})`);
      return existing.uid;
    }
    throw err;
  }
}

// Writes a volunteer-shaped user doc. Used for both volunteer-only and
// dual-role (volunteer+customer) fixtures — only `roles` differs.
async function writeVolunteerProfile(v, roles) {
  const uid = await upsertUser(v.email, v.password, v.displayName);
  const h3Cell = await latLngToH3(v.lat, v.lng);
  const skills = pickSkills(4 + Math.floor(Math.random() * 2)); // 4 or 5 skills

  const skillPoints = {};
  for (const sk of skills) {
    skillPoints[sk] = Math.max(
      1,
      Math.floor(v.verifiedTaskCount / Math.max(1, skills.length)),
    );
  }

  await db.collection('users').doc(uid).set({
    displayName: v.displayName,
    photoURL: `users/${uid}/photo`,
    bio: v.bio,
    email: v.email,
    roles,
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

  return { uid, skills };
}

async function writeCustomerProfile(c) {
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

  return { uid };
}

// ---------------------------------------------------------------------------
// Seed groups
// ---------------------------------------------------------------------------

async function seedVolunteersOnly() {
  console.log('\n── Volunteers (volunteer only) ─────────────────────────────');
  for (const v of VOLUNTEERS_ONLY) {
    const { skills } = await writeVolunteerProfile(v, ['volunteer']);
    console.log(
      `  ✓ Firestore  ${v.displayName.padEnd(8)} trust=${v.trustScore}  roles=[volunteer]  skills=[${skills.join(', ')}]`,
    );
  }
}

async function seedCustomersOnly() {
  console.log('\n── Customers (customer only) ──────────────────────────────');
  for (const c of CUSTOMERS_ONLY) {
    await writeCustomerProfile(c);
    console.log(`  ✓ Firestore  ${c.displayName.padEnd(8)} roles=[customer]`);
  }
}

async function seedBoth() {
  console.log('\n── Dual role (volunteer + customer) ───────────────────────');
  for (const v of BOTH) {
    const { skills } = await writeVolunteerProfile(v, ['volunteer', 'customer']);
    console.log(
      `  ✓ Firestore  ${v.displayName.padEnd(8)} trust=${v.trustScore}  roles=[volunteer, customer]  skills=[${skills.join(', ')}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Seeding test users into local emulators ===');

  await seedVolunteersOnly();
  await seedCustomersOnly();
  await seedBoth();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('Credentials  (password: pass123 for all below):');
  console.log('');
  console.log('  Volunteer only');
  for (const v of VOLUNTEERS_ONLY) console.log(`    ${v.email.padEnd(22)} ${v.displayName}`);
  console.log('');
  console.log('  Customer only');
  for (const c of CUSTOMERS_ONLY) console.log(`    ${c.email.padEnd(22)} ${c.displayName}`);
  console.log('');
  console.log('  Dual role (volunteer + customer)');
  for (const v of BOTH) console.log(`    ${v.email.padEnd(22)} ${v.displayName}`);
  console.log('');
  console.log('  Admins seeded separately — run: npm run seed:admin');
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
