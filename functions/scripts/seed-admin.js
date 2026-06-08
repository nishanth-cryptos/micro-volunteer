// Script to seed a permanent admin user in local Firebase Auth + Firestore emulators.
// Run using the Admin SDK from the functions context to bypass client security rules.

// Set emulator environment variables before loading the Admin SDK
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: 'micro---volunteer',
});

const auth = getAuth();
const db = getFirestore();

async function seedAdmin() {
  const email = 'admin@example.org';
  const password = 'admin123';

  console.log(`Seeding admin user: ${email} via Admin SDK...`);

  let uid;
  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: 'Admin User',
    });
    uid = userRecord.uid;
    console.log(`Created new auth user with UID: ${uid}`);
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? err.code : '';
    if (errorCode === 'auth/email-already-exists') {
      console.log('Auth user already exists. Retrieving UID...');
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      console.log(`Found existing user. UID: ${uid}`);
    } else {
      console.error('Failed to create/retrieve auth user:', err);
      process.exit(1);
    }
  }

  // Create/update user document in Firestore (Admin SDK bypasses security rules)
  const userDocRef = db.collection('users').doc(uid);
  await userDocRef.set({
    displayName: 'Admin User',
    photoURL: 'users/admin/photo', // dummy photo path
    bio: 'System Administrator',
    email: email,
    roles: ['admin', 'volunteer', 'customer'],
    isAdmin: true,
    consent: {
      tcVersion: 'v1-DRAFT',
      acceptedAt: new Date(),
    },
    createdAt: new Date(),
    accountStatus: 'active',
  });

  console.log('\nFirestore admin user document successfully written!');
  console.log('----------------------------------------------------');
  console.log(`Admin Credentials:`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log('----------------------------------------------------');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
