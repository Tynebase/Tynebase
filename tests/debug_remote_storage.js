const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const tenantId = '9cd656f9-d0d2-4b7a-8400-7e48f63356b8';
  
  console.log('=== Checking Remote Storage ===');
  console.log('Tenant ID:', tenantId);
  console.log('Supabase URL:', supabaseUrl);
  
  // 1. Test the function
  console.log('\n--- Function Result ---');
  const { data: funcResult, error: funcError } = await supabase
    .rpc('get_tenant_storage_usage', { tenant_id_param: tenantId });
  console.log('Result:', funcResult);
  console.log('Error:', funcError);

  // 2. List buckets
  console.log('\n--- Buckets ---');
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));
  if (bucketsErr) console.log('Buckets Error:', bucketsErr);

  // 3. List files in tenant-uploads
  console.log('\n--- Files in tenant-uploads ---');
  const { data: uploads, error: uploadsErr } = await supabase.storage
    .from('tenant-uploads')
    .list('', { limit: 20 });
  console.log('Root folders:', uploads?.map(f => ({ name: f.name, metadata: f.metadata })));
  if (uploadsErr) console.log('Uploads Error:', uploadsErr);

  // 4. Try listing with tenant prefix
  console.log('\n--- Files with tenant prefix ---');
  const { data: tenantFiles, error: tenantErr } = await supabase.storage
    .from('tenant-uploads')
    .list(`tenant-${tenantId}`, { limit: 20 });
  console.log('Tenant files:', tenantFiles);
  if (tenantErr) console.log('Tenant Error:', tenantErr);

  // 5. List files in per-tenant bucket
  console.log('\n--- Files in per-tenant bucket ---');
  const { data: perTenantFiles, error: perTenantErr } = await supabase.storage
    .from(`tenant-${tenantId}-uploads`)
    .list('', { limit: 20 });
  console.log('Per-tenant bucket files:', perTenantFiles);
  if (perTenantErr) console.log('Per-tenant Error:', perTenantErr);

  // 6. List files in per-tenant documents bucket
  console.log('\n--- Files in per-tenant documents bucket ---');
  const { data: perTenantDocs, error: perTenantDocsErr } = await supabase.storage
    .from(`tenant-${tenantId}-documents`)
    .list('', { limit: 20 });
  console.log('Per-tenant docs bucket files:', perTenantDocs);
  if (perTenantDocsErr) console.log('Per-tenant docs Error:', perTenantDocsErr);

  // 5. Check documents table
  console.log('\n--- Documents ---');
  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('id, title, tenant_id')
    .eq('tenant_id', tenantId)
    .limit(5);
  console.log('Documents:', docs);
  if (docsErr) console.log('Docs Error:', docsErr);
}

debug().catch(console.error);
