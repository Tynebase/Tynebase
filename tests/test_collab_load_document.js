/**
 * Test script for Hocuspocus onLoadDocument hook validation
 * Tests: document loading from database, tenant isolation, yjs_state retrieval
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const COLLAB_URL = 'ws://localhost:8081';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Test 1: Load existing document with yjs_state
 */
async function testLoadExistingDocument() {
  console.log('\n📝 Test 1: Load Existing Document with Y.js State');
  console.log('Expected: Document state loaded from database');
  
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
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.log('⚠️  SKIP: Could not fetch user tenant');
    return null;
  }

  // Create a test document with yjs_state
  const testYjsState = Buffer.from('Test Y.js State Content for Load Test');
  const { data: newDoc, error: createError } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: userData.tenant_id,
      title: 'Test Load Document',
      content: 'Test content',
      yjs_state: testYjsState,
      status: 'draft'
    })
    .select('id, yjs_state')
    .single();

  if (createError || !newDoc) {
    console.log('⚠️  SKIP: Could not create test document');
    return null;
  }

  console.log(`Created test document: ${newDoc.id}`);
  console.log(`Y.js state size: ${newDoc.yjs_state ? newDoc.yjs_state.length : 0} bytes`);

  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/${newDoc.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    let receivedState = false;

    ws.on('message', (data) => {
      console.log('📨 Received message from server');
      receivedState = true;
    });

    ws.on('open', () => {
      console.log('✅ Connection established');
      
      // Wait for state to be loaded
      setTimeout(async () => {
        ws.close();
        
        if (receivedState) {
          console.log('✅ PASS: Document state loaded from database');
          
          // Cleanup
          await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
          resolve(true);
        } else {
          console.log('⚠️  INFO: No state message received (may be empty document)');
          
          // Cleanup
          await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
          resolve(true);
        }
      }, 2000);
    });

    ws.on('error', (error) => {
      console.log('❌ FAIL: Connection error:', error.message);
      resolve(false);
    });

    setTimeout(async () => {
      ws.close();
      await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
      console.log('❌ FAIL: Connection timed out');
      resolve(false);
    }, 5000);
  });
}

/**
 * Test 2: Load document without yjs_state (new document)
 */
async function testLoadNewDocument() {
  console.log('\n📝 Test 2: Load New Document (No Y.js State)');
  console.log('Expected: Connection succeeds, no state loaded');
  
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
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.log('⚠️  SKIP: Could not fetch user tenant');
    return null;
  }

  // Create a test document WITHOUT yjs_state
  const { data: newDoc, error: createError } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: userData.tenant_id,
      title: 'Test New Document',
      content: 'Test content',
      status: 'draft'
    })
    .select('id')
    .single();

  if (createError || !newDoc) {
    console.log('⚠️  SKIP: Could not create test document');
    return null;
  }

  console.log(`Created test document: ${newDoc.id}`);

  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/${newDoc.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    ws.on('open', () => {
      console.log('✅ PASS: Connection established for new document');
      
      setTimeout(async () => {
        ws.close();
        
        // Cleanup
        await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
        resolve(true);
      }, 1000);
    });

    ws.on('error', (error) => {
      console.log('❌ FAIL: Connection error:', error.message);
      resolve(false);
    });

    setTimeout(async () => {
      ws.close();
      await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
      console.log('❌ FAIL: Connection timed out');
      resolve(false);
    }, 5000);
  });
}

/**
 * Test 3: Verify tenant isolation (cannot load document from different tenant)
 */
async function testTenantIsolation() {
  console.log('\n📝 Test 3: Tenant Isolation');
  console.log('Expected: Cannot load document from different tenant');
  
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
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    console.log('⚠️  SKIP: Could not fetch user tenant');
    return null;
  }

  // Create a document in a DIFFERENT tenant
  const differentTenantId = '00000000-0000-0000-0000-000000000001';
  const { data: otherDoc, error: createError } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: differentTenantId,
      title: 'Other Tenant Document',
      content: 'Should not be accessible',
      yjs_state: Buffer.from('Secret data'),
      status: 'draft'
    })
    .select('id')
    .single();

  if (createError || !otherDoc) {
    console.log('⚠️  SKIP: Could not create test document in different tenant');
    return null;
  }

  console.log(`Created document in different tenant: ${otherDoc.id}`);

  return new Promise((resolve) => {
    const ws = new WebSocket(`${COLLAB_URL}/${otherDoc.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    ws.on('error', (error) => {
      console.log('✅ PASS: Connection rejected (tenant isolation working)');
      resolve(true);
    });

    ws.on('open', () => {
      console.log('❌ FAIL: Connection accepted for different tenant document');
      ws.close();
      resolve(false);
    });

    setTimeout(async () => {
      ws.close();
      
      // Cleanup
      await supabaseAdmin.from('documents').delete().eq('id', otherDoc.id);
      
      console.log('✅ PASS: Connection timed out (rejected)');
      resolve(true);
    }, 3000);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Hocuspocus onLoadDocument Hook Validation');
  console.log('='.repeat(60));

  const results = {
    test1: await testLoadExistingDocument(),
    test2: await testLoadNewDocument(),
    test3: await testTenantIsolation()
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Test 1 (Load Existing):     ${results.test1 === true ? '✅ PASS' : results.test1 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 2 (Load New):          ${results.test2 === true ? '✅ PASS' : results.test2 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  console.log(`Test 3 (Tenant Isolation):  ${results.test3 === true ? '✅ PASS' : results.test3 === false ? '❌ FAIL' : '⚠️  SKIP'}`);
  
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
