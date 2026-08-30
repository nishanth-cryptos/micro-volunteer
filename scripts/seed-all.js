// Seed all data (Admins + Volunteers + Customers + Dual-Role) in one step.
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('====================================================');
console.log('   🌱 Seeding All Hey Padosi Test Data');
console.log('====================================================\n');

try {
  console.log('[1/2] Seeding Admin accounts (admin@example.org)...');
  execSync('node scripts/seed-admin.js', { cwd: projectRoot, stdio: 'inherit' });
  console.log('✅ Admin accounts seeded.\n');

  console.log('[2/2] Seeding Users (volunteers, customers, dual-role)...');
  execSync('node scripts/seed-users.js', { cwd: projectRoot, stdio: 'inherit' });
  console.log('✅ Test users seeded.\n');

  console.log('----------------------------------------------------');
  console.log('🎉 All test accounts are ready:');
  console.log('   - Customer:   cus@example.com  (pass123)');
  console.log('   - Volunteer:  vol@example.com  (pass123)');
  console.log('   - Dual-Role:  both@example.com (pass123)');
  console.log('   - Admin:      admin@example.org (admin123)');
  console.log('----------------------------------------------------\n');
} catch (err) {
  console.error('❌ Error during seeding:', err.message);
  process.exit(1);
}
