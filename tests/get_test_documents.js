const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTestDocuments() {
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, title, tenant_id')
    .eq('tenant_id', '1521f0ae-4db7-4110-a993-c494535d9b00')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Test Tenant Documents:');
  console.log(JSON.stringify(documents, null, 2));
}

getTestDocuments();
