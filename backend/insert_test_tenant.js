// Insert test tenant for middleware validation
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertTestTenant() {
  console.log('Inserting test tenant...');
  
  const { data, error } = await supabase
    .from('tenants')
    .upsert(
      {
        subdomain: 'test',
        name: 'Test Corporation',
        tier: 'free',
        settings: { ai_provider: 'openai' }
      },
      { onConflict: 'subdomain' }
    )
    .select();

  if (error) {
    console.error('Error inserting tenant:', error);
    process.exit(1);
  }

  console.log('Test tenant created/updated:', data);
  
  // Verify
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('*')
    .eq('subdomain', 'test')
    .single();

  if (fetchError) {
    console.error('Error fetching tenant:', fetchError);
    process.exit(1);
  }

  console.log('Verified tenant:', tenant);
  process.exit(0);
}

insertTestTenant();
