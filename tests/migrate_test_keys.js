/**
 * Migration script to update all test files to use new Supabase API keys
 * with fallback to old keys for backward compatibility
 */

const fs = require('fs');
const path = require('path');

const testDir = __dirname;

// Pattern 1: Replace SUPABASE_SERVICE_ROLE_KEY with fallback to new secret key
const pattern1Old = /const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY;/g;
const pattern1New = `const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;`;

// Pattern 2: Replace SUPABASE_ANON_KEY with fallback to new publishable key
const pattern2Old = /const SUPABASE_ANON_KEY = process\.env\.SUPABASE_ANON_KEY;/g;
const pattern2New = `const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;`;

// Pattern 3: Replace uppercase SERVICE_ROLE_KEY
const pattern3Old = /const SUPABASE_SERVICE_ROLE_KEY = process\.env\.SUPABASE_SERVICE_ROLE_KEY;/g;
const pattern3New = `const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;`;

// Pattern 4: Replace supabaseAnonKey variable
const pattern4Old = /const supabaseAnonKey = process\.env\.SUPABASE_ANON_KEY;/g;
const pattern4New = `const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;`;

// Pattern 5: Update error messages for SERVICE_ROLE_KEY
const pattern5Old = /Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/g;
const pattern5New = `Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY`;

// Pattern 6: Update error messages for ANON_KEY
const pattern6Old = /Missing SUPABASE_URL or SUPABASE_ANON_KEY/g;
const pattern6New = `Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY`;

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updated = content;
  let changed = false;

  // Apply all patterns
  if (pattern1Old.test(updated)) {
    updated = updated.replace(pattern1Old, pattern1New);
    changed = true;
  }
  
  if (pattern2Old.test(updated)) {
    updated = updated.replace(pattern2Old, pattern2New);
    changed = true;
  }
  
  if (pattern3Old.test(updated)) {
    updated = updated.replace(pattern3Old, pattern3New);
    changed = true;
  }
  
  if (pattern4Old.test(updated)) {
    updated = updated.replace(pattern4Old, pattern4New);
    changed = true;
  }
  
  if (pattern5Old.test(updated)) {
    updated = updated.replace(pattern5Old, pattern5New);
    changed = true;
  }
  
  if (pattern6Old.test(updated)) {
    updated = updated.replace(pattern6Old, pattern6New);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  
  return false;
}

// Get all .js files in tests directory
const files = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.js') && file !== 'migrate_test_keys.js')
  .map(file => path.join(testDir, file));

console.log(`🔍 Found ${files.length} test files to check\n`);

let migratedCount = 0;
files.forEach(file => {
  const fileName = path.basename(file);
  if (migrateFile(file)) {
    console.log(`✅ Migrated: ${fileName}`);
    migratedCount++;
  } else {
    console.log(`⏭️  Skipped: ${fileName} (no changes needed)`);
  }
});

console.log(`\n✨ Migration complete! Updated ${migratedCount} files.`);
