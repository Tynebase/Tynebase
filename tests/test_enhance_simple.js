/**
 * Simple test for enhance endpoint - uses existing account
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

// Use the account from the last successful test
const TEST_EMAIL = 'enhance-test-1769426823489@test.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_TENANT = 'enhance-test-1769426823489';

let authToken = null;
let tenantSubdomain = null;
let testDocumentId = null;

async function login() {
  console.log('\n🔐 Step 1: Logging in...');
  
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${error}`);
  }

  const data = await response.json();
  authToken = data.data.access_token;
  tenantSubdomain = TEST_TENANT;
  
  console.log('✅ Logged in successfully');
  console.log(`   Token: ${authToken.substring(0, 20)}...`);
  console.log(`   Tenant: ${tenantSubdomain}`);
}

async function createDocument() {
  console.log('\n📄 Step 2: Creating test document...');
  
  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      title: 'Test Document for Enhancement',
      content: 'This is a test document. It has some content that could be improved. The writing style needs work.',
      type: 'document',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Document creation failed: ${error}`);
  }

  const data = await response.json();
  testDocumentId = data.data.document.id;
  
  console.log('✅ Document created successfully');
  console.log(`   Document ID: ${testDocumentId}`);
}

async function enhanceDocument() {
  console.log('\n✨ Step 3: Requesting document enhancement...');
  
  const response = await fetch(`${API_URL}/api/ai/enhance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      document_id: testDocumentId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Enhancement request failed: ${error}`);
  }

  const data = await response.json();
  
  console.log('✅ Enhancement analysis completed');
  console.log('\n📊 Response:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.data) {
    const enhanceData = data.data;
    console.log(`\n   Score: ${enhanceData.score || 'N/A'}%`);
    console.log(`   Suggestions: ${enhanceData.suggestions?.length || 0}`);
    
    if (enhanceData.suggestions && enhanceData.suggestions.length > 0) {
      console.log('\n   Suggestions:');
      enhanceData.suggestions.forEach((s, i) => {
        console.log(`   ${i + 1}. [${s.type}] ${s.title}`);
        console.log(`      ${s.reason}`);
      });
    }
    
    return enhanceData.suggestions || [];
  }
  
  return [];
}

async function cleanup() {
  if (!testDocumentId) return;
  
  try {
    console.log('\n🧹 Cleanup: Deleting test document...');
    await fetch(`${API_URL}/api/documents/${testDocumentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });
    console.log('✅ Test document deleted');
  } catch (err) {
    console.log('⚠️  Cleanup failed (non-critical):', err.message);
  }
}

async function runTest() {
  console.log('🧪 Testing Document Enhancement (Simple)\n');
  console.log('='.repeat(60));
  
  try {
    await login();
    await createDocument();
    const suggestions = await enhanceDocument();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED');
    console.log('='.repeat(60));
    console.log(`\n✨ Enhancement feature is working!`);
    console.log(`   - Document analyzed successfully`);
    console.log(`   - Received ${suggestions.length} suggestions`);
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(60));
    console.log('\nError:', error.message);
    console.log('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTest();
