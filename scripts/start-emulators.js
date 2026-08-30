// Launcher script for Firebase Emulators — auto-detects JDK 21 in ../jdk21.
import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

const parentJdkDir = resolve('../jdk21');
let jdk21Bin = null;
let jdk21Home = null;

if (existsSync(parentJdkDir)) {
  try {
    const entries = readdirSync(parentJdkDir);
    for (const entry of entries) {
      const homePath = join(parentJdkDir, entry);
      const javaBin = join(homePath, 'bin');
      if (
        existsSync(join(javaBin, 'java.exe')) ||
        existsSync(join(javaBin, 'java'))
      ) {
        jdk21Bin = javaBin;
        jdk21Home = homePath;
        break;
      }
    }
  } catch {
    /* fallback to system env */
  }
}

const env = { ...process.env };

// Handle Windows case-insensitive PATH variable (Path vs PATH)
const pathKey =
  Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
const existingPath = env[pathKey] || '';
const nodeBin = dirname(process.execPath);

if (jdk21Bin && jdk21Home) {
  env.JAVA_HOME = jdk21Home;
  env[pathKey] = `${jdk21Bin};${nodeBin};${existingPath}`;
  console.log(`[Firebase Emulators] Loaded JDK 21 from: ${jdk21Home}`);
}

const localFirebaseCmd = resolve('./node_modules/.bin/firebase.cmd');
const localFirebase = resolve('./node_modules/.bin/firebase');

let binToRun = 'npx';
let binArgs = [
  'firebase',
  'emulators:start',
  '--import=./emulator-data',
  '--export-on-exit=./emulator-data',
];

if (process.platform === 'win32' && existsSync(localFirebaseCmd)) {
  binToRun = localFirebaseCmd;
  binArgs = [
    'emulators:start',
    '--import=./emulator-data',
    '--export-on-exit=./emulator-data',
  ];
} else if (existsSync(localFirebase)) {
  binToRun = localFirebase;
  binArgs = [
    'emulators:start',
    '--import=./emulator-data',
    '--export-on-exit=./emulator-data',
  ];
}

const child = spawn(binToRun, binArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
