const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function debug() {
  // 1. Check if function exists
  const { data: funcCheck, error: funcErr } = await supabase.rpc('get_tenant_storage_usage', { 
    tenant_id_param: '00000000-0000-0000-0000-000000000001' 
  });
  console.log('Function result:', funcCheck, funcErr);

  // 2. List storage buckets
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  console.log('\nBuckets:', buckets, bucketsErr);

  // 3. List files in tenant-uploads bucket
  const { data: files, error: filesErr } = await supabase.storage.from('tenant-uploads').list('', { limit: 50 });
  console.log('\nFiles in tenant-uploads:', files, filesErr);

  // 4. List files in tenant-documents bucket
  const { data: docs, error: docsErr } = await supabase.storage.from('tenant-documents').list('', { limit: 50 });
  console.log('\nFiles in tenant-documents:', docs, docsErr);

  // 5. Check documents table
  const { data: docRows, error: docRowsErr } = await supabase
    .from('documents')
    .select('id, tenant_id, content')
    .limit(5);
  console.log('\nDocuments:', docRows?.map(d => ({ id: d.id, tenant_id: d.tenant_id, contentLen: d.content?.length })), docRowsErr);
}

debug().catch(console.error);
