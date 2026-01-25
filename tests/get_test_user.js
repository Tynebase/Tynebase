/**
 * Get test user ID from database
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTestUser() {
  const testTenantId = '1521f0ae-4db7-4110-a993-c494535d9b00';
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, tenant_id')
    .eq('tenant_id', testTenantId)
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (users && users.length > 0) {
    console.log('Test User Found:');
    console.log(JSON.stringify(users[0], null, 2));
  } else {
    console.log('No users found for test tenant');
  }
}

getTestUser();
