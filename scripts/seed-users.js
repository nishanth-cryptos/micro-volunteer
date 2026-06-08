// Root redirect wrapper — delegates to the Admin SDK seed script in functions/.
// Run via: npm run seed:users  (from project root)
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

try {
  execSync('node functions/scripts/seed-users.js', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch {
  process.exit(1);
}
