// Redirect wrapper to run the Admin SDK-based seed script in the functions directory context.
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

try {
  execSync('node functions/scripts/seed-admin.js', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch (err) {
  process.exit(1);
}
