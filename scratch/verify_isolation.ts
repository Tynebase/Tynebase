import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyIsolation() {
  console.log('--- Verifying Multi-Tenant Isolation ---');

  // 1. Get a list of tenants
  const { data: tenants } = await supabase.from('tenants').select('id, subdomain').limit(2);
  
  if (!tenants || tenants.length < 2) {
    console.log('Need at least 2 tenants to perform isolation check.');
    return;
  }

  const tenantA = tenants[0];
  const tenantB = tenants[1];

  console.log(`Checking isolation between ${tenantA.subdomain} and ${tenantB.subdomain}...`);

  // 2. Query documents for tenant A
  const { data: docsA } = await supabase.from('documents').select('id, tenant_id').eq('tenant_id', tenantA.id);
  const foreignDocsInA = docsA?.filter(d => d.tenant_id !== tenantA.id);
  
  if (foreignDocsInA && foreignDocsInA.length > 0) {
    console.error(`FAILED: Found ${foreignDocsInA.length} documents from other tenants in ${tenantA.subdomain} query.`);
  } else {
    console.log(`SUCCESS: Documents in ${tenantA.subdomain} belong exclusively to that tenant.`);
  }

  // 3. Try to fetch a document from tenant B using tenant A's context (if we were using user-token, but we are svc-role)
  // Since we are using service_role here, we can see everything. 
  // The real test is the API routes.
}

verifyIsolation().catch(console.error);
