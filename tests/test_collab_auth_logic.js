/**
 * Validation script for Task 8.3: Hocuspocus Authentication Hook
 * Tests the authentication logic without requiring WebSocket connection
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_USER_EMAIL = 'testuser@tynebase.test';
const TEST_USER_PASSWORD = 'TestPassword123!';
const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

/**
 * Simulate the onAuthenticate hook logic
 */
async function simulateAuthentication(token, documentId) {
  try {
    if (!token) {
      throw new Error('Authentication token required');
    }

    if (!documentId) {
      throw new Error('Document name required');
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, tenant_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      throw new Error('User not found');
    }

    if (userRecord.tenant_id !== document.tenant_id) {
      throw new Error('Unauthorized access to document');
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        tenant_id: userRecord.tenant_id
      },
      document: {
        id: document.id,
        tenant_id: document.tenant_id
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test 1: Invalid token should be rejected
 */
async function test1_InvalidToken() {
  console.log('\n📝 Test 1: Invalid Token');
  console.log('Expected: Authentication rejected');
  
  const result = await simulateAuthentication('invalid_token_12345', '8339c226-f0ea-4504-bfc5-821258617504');
  
  if (!result.success && result.error.includes('Invalid authentication token')) {
    console.log('✅ PASS: Invalid token rejected');
    return true;
  } else {
    console.log('❌ FAIL: Invalid token was not properly rejected');
    console.log('Result:', result);
    return false;
  }
}

/**
 * Test 2: Valid token but non-existent document should be rejected
 */
async function test2_NonExistentDocument() {
  console.log('\n📝 Test 2: Valid Token + Non-existent Document');
  console.log('Expected: Document not found error');
  
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (authError || !authData.session) {
    console.log('⚠️  SKIP: Could not authenticate test user');
    console.log('Error:', authError?.message);
    return null;
  }

  const token = authData.session.access_token;
  const result = await simulateAuthentication(token, '00000000-0000-0000-0000-000000000000');
  
  if (!result.success && result.error.includes('Document not found')) {
    console.log('✅ PASS: Non-existent document rejected');
    return true;
  } else {
    console.log('❌ FAIL: Non-existent document was not properly rejected');
    console.log('Result:', result);
    return false;
  }
}

/**
 * Test 3: Valid token + document from different tenant should be rejected
 */
async function test3_UnauthorizedDocument() {
  console.log('\n📝 Test 3: Valid Token + Unauthorized Document');
  console.log('Expected: Unauthorized access error');
  
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (authError || !authData.session) {
    console.log('⚠️  SKIP: Could not authenticate test user');
    return null;
  }

  const { data: otherTenantDoc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .neq('tenant_id', TEST_TENANT_ID)
    .limit(1)
    .single();

  if (!otherTenantDoc) {
    console.log('⚠️  SKIP: No documents from other tenants found');
    return null;
  }

  const token = authData.session.access_token;
  const result = await simulateAuthentication(token, otherTenantDoc.id);
  
  if (!result.success && result.error.includes('Unauthorized access')) {
    console.log('✅ PASS: Unauthorized document access rejected');
    return true;
  } else {
    console.log('❌ FAIL: Unauthorized document access was not properly rejected');
    console.log('Result:', result);
    return false;
  }
}

/**
 * Test 4: Valid token + authorized document should be accepted
 */
async function test4_AuthorizedAccess() {
  console.log('\n📝 Test 4: Valid Token + Authorized Document');
  console.log('Expected: Authentication successful');
  
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (authError || !authData.session) {
    console.log('⚠️  SKIP: Could not authenticate test user');
    return null;
  }

  const { data: testDoc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('tenant_id', TEST_TENANT_ID)
    .limit(1)
    .single();

  if (!testDoc) {
    console.log('⚠️  SKIP: No documents found for test tenant');
    return null;
  }

  const token = authData.session.access_token;
  const result = await simulateAuthentication(token, testDoc.id);
  
  if (result.success && result.user && result.document) {
    console.log('✅ PASS: Authorized access accepted');
    console.log(`   User: ${result.user.email} (tenant: ${result.user.tenant_id})`);
    console.log(`   Document: ${result.document.id} (tenant: ${result.document.tenant_id})`);
    return true;
  } else {
    console.log('❌ FAIL: Authorized access was rejected');
    console.log('Result:', result);
    return false;
  }
}

/**
 * Test 5: Missing token should be rejected
 */
async function test5_MissingToken() {
  console.log('\n📝 Test 5: Missing Token');
  console.log('Expected: Token required error');
  
  const result = await simulateAuthentication(null, '8339c226-f0ea-4504-bfc5-821258617504');
  
  if (!result.success && result.error.includes('Authentication token required')) {
    console.log('✅ PASS: Missing token rejected');
    return true;
  } else {
    console.log('❌ FAIL: Missing token was not properly rejected');
    console.log('Result:', result);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 Task 8.3: Hocuspocus Authentication Hook Validation');
  console.log('='.repeat(70));

  const results = {
    test1: await test1_InvalidToken(),
    test2: await test2_NonExistentDocument(),
    test3: await test3_UnauthorizedDocument(),
    test4: await test4_AuthorizedAccess(),
    test5: await test5_MissingToken()
  };

  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(70));
  console.log(`Test 1 (Invalid Token):              ${results.test1 === true ? '✅ PASS' : results.test1 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 2 (Non-existent Document):      ${results.test2 === true ? '✅ PASS' : results.test2 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 3 (Unauthorized Document):      ${results.test3 === true ? '✅ PASS' : results.test3 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 4 (Authorized Access):          ${results.test4 === true ? '✅ PASS' : results.test4 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 5 (Missing Token):              ${results.test5 === true ? '✅ PASS' : results.test5 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n❌ VALIDATION FAILED');
    process.exit(1);
  } else if (passed >= 4) {
    console.log('\n✅ VALIDATION PASSED');
    process.exit(0);
  } else {
    console.log('\n⚠️  VALIDATION INCOMPLETE (too many skipped tests)');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
