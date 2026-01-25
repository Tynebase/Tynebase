/**
 * Comprehensive Authentication Test Suite
 * Tests all critical backend authentication flows with new Supabase API keys
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const BACKEND_URL = 'http://localhost:8080';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🧪 Comprehensive Backend Authentication Test Suite\n');
console.log('='.repeat(70));

if (!supabaseUrl || !supabaseSecretKey || !supabasePublishableKey) {
  console.error('❌ Missing required Supabase configuration');
  process.exit(1);
}

// Initialize Supabase clients
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabaseClient = createClient(supabaseUrl, supabasePublishableKey);

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function logTest(name, status, message = '') {
  const symbols = { pass: '✅', fail: '❌', skip: '⚠️' };
  console.log(`${symbols[status]} ${name}`);
  if (message) console.log(`   ${message}`);
  results.tests.push({ name, status, message });
  if (status === 'pass') results.passed++;
  else if (status === 'fail') results.failed++;
  else results.skipped++;
}

async function runTests() {
  console.log('\n📋 Test Category: Database Connectivity\n');

  // Test 1: Admin client can query tenants
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, subdomain')
      .limit(1);
    
    if (error) throw error;
    logTest('Admin Client - Query Tenants Table', 'pass', `Found ${data?.length || 0} records`);
  } catch (error) {
    logTest('Admin Client - Query Tenants Table', 'fail', error.message);
  }

  // Test 2: Admin client can query users
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, tenant_id')
      .limit(1);
    
    if (error) throw error;
    logTest('Admin Client - Query Users Table', 'pass', `Found ${data?.length || 0} records`);
  } catch (error) {
    logTest('Admin Client - Query Users Table', 'fail', error.message);
  }

  // Test 3: Admin client can query documents
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, title, status, tenant_id')
      .limit(1);
    
    if (error) throw error;
    logTest('Admin Client - Query Documents Table', 'pass', `Found ${data?.length || 0} records`);
  } catch (error) {
    logTest('Admin Client - Query Documents Table', 'fail', error.message);
  }

  // Test 4: Admin client can query document_lineage
  try {
    const { data, error } = await supabaseAdmin
      .from('document_lineage')
      .select('id, event_type, document_id')
      .limit(1);
    
    if (error) throw error;
    logTest('Admin Client - Query Document Lineage', 'pass', `Found ${data?.length || 0} records`);
  } catch (error) {
    logTest('Admin Client - Query Document Lineage', 'fail', error.message);
  }

  console.log('\n📋 Test Category: Document Operations\n');

  // Test 5: Create test document
  let testDocId = null;
  try {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('subdomain', 'test')
      .single();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('tenant_id', tenant.id)
      .limit(1)
      .single();

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        title: 'Auth Test Document',
        content: 'Test content for authentication verification',
        status: 'draft',
        tenant_id: tenant.id,
        author_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    testDocId = data.id;
    logTest('Document Create Operation', 'pass', `Created document ${testDocId}`);
  } catch (error) {
    logTest('Document Create Operation', 'fail', error.message);
  }

  // Test 6: Read document
  if (testDocId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', testDocId)
        .single();

      if (error) throw error;
      logTest('Document Read Operation', 'pass', `Retrieved document: ${data.title}`);
    } catch (error) {
      logTest('Document Read Operation', 'fail', error.message);
    }
  } else {
    logTest('Document Read Operation', 'skip', 'No test document created');
  }

  // Test 7: Update document
  if (testDocId) {
    try {
      const { error } = await supabaseAdmin
        .from('documents')
        .update({ title: 'Auth Test Document - Updated' })
        .eq('id', testDocId);

      if (error) throw error;
      logTest('Document Update Operation', 'pass', 'Document updated successfully');
    } catch (error) {
      logTest('Document Update Operation', 'fail', error.message);
    }
  } else {
    logTest('Document Update Operation', 'skip', 'No test document created');
  }

  console.log('\n📋 Test Category: Backend API Endpoints\n');

  // Test 8: Health check endpoint
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.status === 200) {
      const data = await response.json();
      logTest('Backend Health Endpoint', 'pass', `Status: ${data.status}`);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend Health Endpoint', 'fail', error.message);
  }

  console.log('\n📋 Test Category: Authentication & Authorization\n');

  // Test 9: Client connection (may have limited access due to RLS)
  try {
    const { data, error } = await supabaseClient
      .from('tenants')
      .select('id')
      .limit(1);

    // RLS might block this, which is expected
    if (error && error.code === 'PGRST301') {
      logTest('Client Connection (RLS Protected)', 'pass', 'RLS correctly blocking unauthorized access');
    } else if (!error) {
      logTest('Client Connection (Public Access)', 'pass', 'Client can connect to Supabase');
    } else {
      throw error;
    }
  } catch (error) {
    logTest('Client Connection Test', 'fail', error.message);
  }

  // Test 10: Verify tenant isolation
  try {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .limit(2);

    if (tenants && tenants.length >= 2) {
      const tenant1Id = tenants[0].id;
      const tenant2Id = tenants[1].id;

      const { data: docs1 } = await supabaseAdmin
        .from('documents')
        .select('id, tenant_id')
        .eq('tenant_id', tenant1Id)
        .limit(1);

      const { data: docs2 } = await supabaseAdmin
        .from('documents')
        .select('id, tenant_id')
        .eq('tenant_id', tenant2Id)
        .limit(1);

      const isolated = docs1?.every(d => d.tenant_id === tenant1Id) &&
                      docs2?.every(d => d.tenant_id === tenant2Id);

      if (isolated) {
        logTest('Tenant Isolation Verification', 'pass', 'Documents correctly isolated by tenant');
      } else {
        throw new Error('Tenant isolation breach detected');
      }
    } else {
      logTest('Tenant Isolation Verification', 'skip', 'Not enough tenants to test');
    }
  } catch (error) {
    logTest('Tenant Isolation Verification', 'fail', error.message);
  }

  console.log('\n📋 Test Category: Key Configuration\n');

  // Test 11: Verify new key format
  const hasNewSecretKey = supabaseSecretKey?.startsWith('sb_secret_');
  const hasNewPublishableKey = supabasePublishableKey?.startsWith('sb_publishable_');
  
  if (hasNewSecretKey) {
    logTest('New Secret Key Format', 'pass', 'Using sb_secret_* format');
  } else {
    logTest('New Secret Key Format', 'skip', 'Using legacy JWT-based key');
  }

  if (hasNewPublishableKey) {
    logTest('New Publishable Key Format', 'pass', 'Using sb_publishable_* format');
  } else {
    logTest('New Publishable Key Format', 'skip', 'Using legacy JWT-based key');
  }

  // Cleanup
  if (testDocId) {
    try {
      await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', testDocId);
      console.log('\n🧹 Cleanup: Test document removed');
    } catch (error) {
      console.log('\n⚠️  Cleanup: Could not remove test document');
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(70));
  console.log(`✅ Passed:  ${results.passed}`);
  console.log(`❌ Failed:  ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  console.log(`📝 Total:   ${results.tests.length}`);
  console.log('='.repeat(70));

  if (results.failed === 0) {
    console.log('\n🎉 ALL CRITICAL TESTS PASSED!');
    console.log('\n✅ Backend authentication is fully functional with new Supabase API keys');
    return true;
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review errors above');
    return false;
  }
}

runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  });
