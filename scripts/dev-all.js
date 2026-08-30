// All-in-one automation script for Hey Padosi:
// 1. Checks if Firebase Emulators are already running (or starts them)
// 2. Automatically waits until emulators are online and healthy
// 3. Seeds Admin accounts (admin@example.org) and test users (volunteers, customers, dual-role)
// 4. Starts the Vite dev server (http://localhost:5173/)
// 5. Handles clean shutdown on Ctrl+C

import { spawn } from 'child_process';
import net from 'net';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolveResult) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.connect(port, host);
  });
}

async function waitForEmulators(maxRetries = 60, delayMs = 1000) {
  process.stdout.write('\n⏳ Waiting for Firebase Emulators to initialize');
  for (let i = 0; i < maxRetries; i++) {
    const authOk = await checkPort(9099);
    const firestoreOk = await checkPort(8080);
    if (authOk && firestoreOk) {
      console.log('\n✅ Firebase Emulators are online and ready!\n');
      return true;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error('\n❌ Timed out waiting for Firebase Emulators.\n');
  return false;
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
    });
    child.on('error', rejectPromise);
  });
}

async function main() {
  console.log('====================================================');
  console.log('   🚀 Starting Hey Padosi All-in-One Dev Stack');
  console.log('====================================================\n');

  let emulatorsProcess = null;
  const alreadyRunning = (await checkPort(9099)) && (await checkPort(8080));

  if (alreadyRunning) {
    console.log('[1/4] Firebase Emulators already running on 9099 & 8080. Connecting to active emulators.\n');
  } else {
    // 1. Spawn Emulators using start-emulators.js
    console.log('[1/4] Starting Firebase Emulators (Auth: 9099, Firestore: 8080, Functions: 5001, UI: 4000)...');
    emulatorsProcess = spawn(process.execPath, ['scripts/start-emulators.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    // 2. Wait for Emulators to become healthy
    const ready = await waitForEmulators();
    if (!ready) {
      console.error('Could not connect to emulators.');
      process.exit(1);
    }
  }

  // Handle process shutdown
  const cleanup = () => {
    console.log('\n\n🛑 Shutting down Hey Padosi dev processes...');
    try {
      if (emulatorsProcess) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', emulatorsProcess.pid.toString(), '/f', '/t']);
        } else {
          emulatorsProcess.kill('SIGINT');
        }
      }
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Brief pause to allow firestore listener init
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Seed data
  try {
    console.log('[2/4] Seeding Admin Accounts (admin@example.org)...');
    await runCommand(process.execPath, ['scripts/seed-admin.js']);
    console.log('✅ Admin accounts seeded.\n');

    console.log('[3/4] Seeding Test Users (Volunteers, Customers, Dual-Role)...');
    await runCommand(process.execPath, ['scripts/seed-users.js']);
    console.log('✅ Test users seeded.\n');
  } catch (err) {
    console.error('⚠️ Warning during data seeding:', err.message);
  }

  // 4. Start Vite Dev Server
  console.log('[4/4] Starting Vite Frontend Server (http://localhost:5173)...');
  console.log('\n----------------------------------------------------');
  console.log('🎉 Hey Padosi is fully initialized and ready!');
  console.log('📱 App URL:          http://localhost:5173');
  console.log('🛠️  Firebase UI:     http://localhost:4000');
  console.log('🔑 Test Users (Pre-seeded & Ready):');
  console.log('   - Customer:       cus@example.com  / cus1@example.com  (Password: pass123)');
  console.log('   - Volunteer:      vol@example.com  / vol1@example.com  (Password: pass123)');
  console.log('   - Dual-Role:      both@example.com / both1@example.com (Password: pass123)');
  console.log('   - Admin:          admin@example.org                    (Password: admin123)');
  console.log('----------------------------------------------------\n');

  const viteBin = resolve('./node_modules/vite/bin/vite.js');
  const viteProcess = spawn(process.execPath, [viteBin], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  viteProcess.on('exit', () => {
    cleanup();
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
