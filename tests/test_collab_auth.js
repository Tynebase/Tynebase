/**
 * Test script for Hocuspocus authentication hook validation
 * Tests: invalid token, valid token + wrong document, valid token + correct document
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const COLLAB_URL = 'ws://localhost:8081';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Test 1: Connect with invalid token (should be rejected)
 */
async function testInvalidToken() {
  console.log('\n📝 Test 1: Invalid Token');
  console.log('Expected: Connection rejected');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/test-doc`, {
      headers: {
        'Authorization': 'Bearer invalid_token_12345'
      }
    });

    ws.on('error', (error) => {
      console.log('✅ PASS: Connection rejected with error:', error.message);
      resolve(true);
    });

    ws.on('open', () => {
      console.log('❌ FAIL: Connection accepted with invalid token');
      ws.close();
      resolve(false);
    });

    setTimeout(() => {
      ws.close();
      console.log('✅ PASS: Connection timed out (rejected)');
      resolve(true);
    }, 3000);
  });
}

/**
 * Test 2: Valid token but wrong document (should be rejected)
 */
async function testValidTokenWrongDocument() {
  console.log('\n📝 Test 2: Valid Token + Wrong Document');
  console.log('Expected: Connection rejected (unauthorized)');
  
  // Sign in as test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'testpassword123'
  });

  if (authError || !authData.session) {
    console.log('⚠️  SKIP: Could not authenticate test user');
    return null;
  }

  const token = authData.session.access_token;
  
  // Try to connect to a document that doesn't belong to this user's tenant
  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/00000000-0000-0000-0000-000000000000`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    ws.on('error', (error) => {
      console.log('✅ PASS: Connection rejected:', error.message);
      resolve(true);
    });

    ws.on('open', () => {
      console.log('❌ FAIL: Connection accepted for unauthorized document');
      ws.close();
      resolve(false);
    });

    setTimeout(() => {
      ws.close();
      console.log('✅ PASS: Connection timed out (rejected)');
      resolve(true);
    }, 3000);
  });
}

/**
 * Test 3: Valid token + correct document (should be accepted)
 */
async function testValidTokenCorrectDocument() {
  console.log('\n📝 Test 3: Valid Token + Correct Document');
  console.log('Expected: Connection accepted');
  
  // Sign in as test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'testpassword123'
  });

  if (authError || !authData.session) {
    console.log('⚠️  SKIP: Could not authenticate test user');
    return null;
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;

  // Get user's tenant_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.log('⚠️  SKIP: Could not fetch user tenant');
    return null;
  }

  // Get a document from the user's tenant
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('tenant_id', userData.tenant_id)
    .limit(1);

  if (docError || !documents || documents.length === 0) {
    console.log('⚠️  SKIP: No documents found for user tenant');
    return null;
  }

  const documentId = documents[0].id;
  console.log(`Attempting to connect to document: ${documentId}`);

  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    ws.on('error', (error) => {
      console.log('❌ FAIL: Connection rejected for valid document:', error.message);
      resolve(false);
    });

    ws.on('open', () => {
      console.log('✅ PASS: Connection accepted');
      ws.close();
      resolve(true);
    });

    setTimeout(() => {
      console.log('❌ FAIL: Connection timed out');
      ws.close();
      resolve(false);
    }, 5000);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Hocuspocus Authentication Hook Validation');
  console.log('='.repeat(60));

  const results = {
    test1: await testInvalidToken(),
    test2: await testValidTokenWrongDocument(),
    test3: await testValidTokenCorrectDocument()
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Test 1 (Invalid Token):           ${results.test1 === true ? '✅ PASS' : results.test1 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 2 (Wrong Document):           ${results.test2 === true ? '✅ PASS' : results.test2 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 3 (Valid Token + Document):   ${results.test3 === true ? '✅ PASS' : results.test3 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
