const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Running migration to fix status constraints...');
    
    // Fix users table constraint
    console.log('Dropping users_status_check constraint...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;'
    });
    
    console.log('Adding updated users_status_check constraint...');
    await supabase.rpc('exec_sql', { 
      sql: `ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted', 'archived'));`
    });
    
    // Fix tenants table constraint
    console.log('Dropping tenants_status_check constraint...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;'
    });
    
    console.log('Adding updated tenants_status_check constraint...');
    await supabase.rpc('exec_sql', { 
      sql: `ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'archived'));`
    });
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
