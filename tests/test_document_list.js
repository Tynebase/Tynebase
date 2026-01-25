/**
 * Test: GET /api/documents endpoint validation
 * Task 2.12: Verify document list endpoint with filtering and tenant isolation
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test tenant credentials
const TEST_TENANT_SUBDOMAIN = 'test';
const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';
const TEST_USER_ID = 'db3ecc55-5240-4589-93bb-8e812519dca3';
const TEST_USER_EMAIL = 'testuser@tynebase.test';

async function testDocumentListEndpoint() {
  console.log('='.repeat(60));
  console.log('TEST: GET /api/documents - Document List Endpoint');
  console.log('='.repeat(60));

  try {
    // Step 1: Generate JWT token for test user
    console.log('\n[1] Generating JWT token for test user...');
    const { data: { session }, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: TEST_USER_EMAIL,
    });

    if (authError) {
      console.error('❌ Failed to generate token:', authError.message);
      return false;
    }

    // Create a session for the test user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: 'dummy', // This won't work, so we'll use admin API
    });

    // Alternative: Use admin API to get user and create custom JWT
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(TEST_USER_ID);
    
    if (userError || !userData.user) {
      console.error('❌ Failed to get user:', userError?.message);
      return false;
    }

    // For testing, we'll create a session using admin API
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      email_confirm: true,
      user_metadata: { tenant_id: TEST_TENANT_ID },
    });

    // Since we can't easily get a JWT, let's use a different approach
    // We'll test the endpoint using the service role key directly
    console.log('✅ Using service role for testing (admin access)');

    // Step 2: Create test documents for validation
    console.log('\n[2] Creating test documents...');
    
    const testDocs = [
      {
        title: 'Test Document 1 - Draft',
        content: '# Test Content 1',
        status: 'draft',
        tenant_id: '1521f0ae-4db7-4110-a993-c494535d9b00',
        author_id: authData.user.id,
      },
      {
        title: 'Test Document 2 - Published',
        content: '# Test Content 2',
        status: 'published',
        tenant_id: '1521f0ae-4db7-4110-a993-c494535d9b00',
        author_id: authData.user.id,
        published_at: new Date().toISOString(),
      },
    ];

    const { data: createdDocs, error: insertError } = await supabase
      .from('documents')
      .insert(testDocs)
      .select();

    if (insertError) {
      console.error('❌ Failed to create test documents:', insertError.message);
      return false;
    }

    console.log(`✅ Created ${createdDocs.length} test documents`);

    // Step 3: Test basic document list (no filters)
    console.log('\n[3] Testing GET /api/documents (no filters)...');
    const response1 = await fetch(`${API_BASE_URL}/api/documents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
        'Content-Type': 'application/json',
      },
    });

    if (!response1.ok) {
      console.error('❌ Request failed:', response1.status, await response1.text());
      return false;
    }

    const result1 = await response1.json();
    console.log('✅ Response:', JSON.stringify(result1, null, 2));

    if (!result1.success || !Array.isArray(result1.data.documents)) {
      console.error('❌ Invalid response structure');
      return false;
    }

    console.log(`✅ Returned ${result1.data.documents.length} documents`);
    console.log(`✅ Pagination: page ${result1.data.pagination.page}, total ${result1.data.pagination.total}`);

    // Step 4: Test filtering by status
    console.log('\n[4] Testing GET /api/documents?status=draft...');
    const response2 = await fetch(`${API_BASE_URL}/api/documents?status=draft`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
        'Content-Type': 'application/json',
      },
    });

    if (!response2.ok) {
      console.error('❌ Request failed:', response2.status, await response2.text());
      return false;
    }

    const result2 = await response2.json();
    const draftDocs = result2.data.documents.filter(doc => doc.status === 'draft');
    
    if (draftDocs.length !== result2.data.documents.length) {
      console.error('❌ Status filter not working - found non-draft documents');
      return false;
    }

    console.log(`✅ Status filter working - found ${draftDocs.length} draft documents`);

    // Step 5: Test filtering by status=published
    console.log('\n[5] Testing GET /api/documents?status=published...');
    const response3 = await fetch(`${API_BASE_URL}/api/documents?status=published`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
        'Content-Type': 'application/json',
      },
    });

    if (!response3.ok) {
      console.error('❌ Request failed:', response3.status, await response3.text());
      return false;
    }

    const result3 = await response3.json();
    const publishedDocs = result3.data.documents.filter(doc => doc.status === 'published');
    
    if (publishedDocs.length !== result3.data.documents.length) {
      console.error('❌ Status filter not working - found non-published documents');
      return false;
    }

    console.log(`✅ Status filter working - found ${publishedDocs.length} published documents`);

    // Step 6: Test pagination
    console.log('\n[6] Testing pagination with limit=1...');
    const response4 = await fetch(`${API_BASE_URL}/api/documents?limit=1&page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
        'Content-Type': 'application/json',
      },
    });

    if (!response4.ok) {
      console.error('❌ Request failed:', response4.status, await response4.text());
      return false;
    }

    const result4 = await response4.json();
    
    if (result4.data.documents.length > 1) {
      console.error('❌ Pagination limit not working');
      return false;
    }

    console.log(`✅ Pagination working - returned ${result4.data.documents.length} document(s)`);
    console.log(`✅ Has next page: ${result4.data.pagination.hasNextPage}`);

    // Step 7: Test tenant isolation
    console.log('\n[7] Testing tenant isolation...');
    const allDocs = result1.data.documents;
    const wrongTenantDocs = allDocs.filter(doc => doc.tenant_id && doc.tenant_id !== '1521f0ae-4db7-4110-a993-c494535d9b00');
    
    if (wrongTenantDocs.length > 0) {
      console.error('❌ Tenant isolation FAILED - found documents from other tenants');
      return false;
    }

    console.log('✅ Tenant isolation working - all documents belong to correct tenant');

    // Cleanup: Delete test documents
    console.log('\n[8] Cleaning up test documents...');
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .in('id', createdDocs.map(doc => doc.id));

    if (deleteError) {
      console.warn('⚠️  Failed to cleanup test documents:', deleteError.message);
    } else {
      console.log('✅ Test documents cleaned up');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    return true;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
testDocumentListEndpoint()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
