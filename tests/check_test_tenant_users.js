/**
 * Check what users exist in the test tenant
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsers() {
  console.log('🔍 Checking users in test tenant...\n');

  // Get test tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, subdomain')
    .eq('subdomain', 'test')
    .single();

  if (tenantError || !tenant) {
    console.error('❌ Test tenant not found:', tenantError);
    return;
  }

  console.log(`✅ Found tenant: ${tenant.subdomain} (${tenant.id})\n`);

  // Get users in this tenant directly
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, tenant_id')
    .eq('tenant_id', tenant.id);

  if (userError) {
    console.error('❌ Failed to fetch users:', userError);
    return;
  }

  console.log(`Found ${users.length} user(s) in test tenant:\n`);
  users.forEach((user, idx) => {
    console.log(`${idx + 1}. Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.full_name || 'N/A'}\n`);
  });
}

checkUsers();
