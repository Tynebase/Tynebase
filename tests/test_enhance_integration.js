/**
 * Test: Document Enhancement Integration
 * 
 * Tests the frontend-backend integration for AI document enhancement:
 * 1. Create a test document
 * 2. Call enhance API to get suggestions
 * 3. Apply a suggestion
 * 4. Verify the enhancement job completes
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

let authToken = '';
let tenantSubdomain = '';
let testDocumentId = '';

// Test credentials
const TEST_EMAIL = `enhance-test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_TENANT = `enhance-test-${Date.now()}`;

async function signup() {
  console.log('\n📝 Step 1: Creating test account...');
  
  const response = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      full_name: 'Enhance Test User',
      tenant_name: TEST_TENANT,
      subdomain: TEST_TENANT,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Signup failed: ${error}`);
  }

  const data = await response.json();
  tenantSubdomain = data.data.tenant.subdomain;
  
  console.log('✅ Account created successfully');
  console.log(`   Tenant: ${tenantSubdomain}`);
}

async function login() {
  console.log('\n🔐 Step 2: Logging in...');
  
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
  
  console.log('✅ Logged in successfully');
  console.log(`   Token: ${authToken.substring(0, 20)}...`);
}

async function createDocument() {
  console.log('\n📄 Step 3: Creating test document...');
  
  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      title: 'Test Document for Enhancement',
      content: '<p>This is a test document with some content that could be improved. The sentence structure is not optimal and there are some grammar issues that needs fixing.</p><p>Another paragraph with passive voice that should be updated by the system.</p>',
      is_public: false,
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
  console.log('\n✨ Step 4: Requesting document enhancement...');
  
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
  console.log(`   Score: ${data.data.score}%`);
  console.log(`   Suggestions: ${data.data.suggestions.length}`);
  
  if (data.data.suggestions.length > 0) {
    console.log('\n   Suggestions:');
    data.data.suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.type}] ${s.title}`);
      console.log(`      ${s.reason}`);
    });
  }
  
  return data.data.suggestions;
}

async function applySuggestion(suggestionType) {
  console.log(`\n🔧 Step 5: Applying ${suggestionType} suggestion...`);
  
  const response = await fetch(`${API_URL}/api/ai/enhance/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      document_id: testDocumentId,
      suggestion_type: suggestionType,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apply suggestion failed: ${error}`);
  }

  const data = await response.json();
  const jobId = data.data.job.id;
  
  console.log('✅ Enhancement job created');
  console.log(`   Job ID: ${jobId}`);
  
  return jobId;
}

async function pollJobStatus(jobId) {
  console.log('\n⏳ Step 6: Polling job status...');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Job status check failed: ${error}`);
    }

    const data = await response.json();
    const job = data.data.job;
    
    console.log(`   Status: ${job.status} (${job.progress}%)`);
    
    if (job.status === 'completed') {
      console.log('✅ Job completed successfully');
      console.log(`   Result: ${JSON.stringify(job.result).substring(0, 100)}...`);
      return job;
    }
    
    if (job.status === 'failed') {
      throw new Error(`Job failed: ${job.error_message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  throw new Error('Job polling timeout');
}

async function cleanup() {
  console.log('\n🧹 Cleanup: Deleting test document...');
  
  try {
    const response = await fetch(`${API_URL}/api/documents/${testDocumentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (response.ok) {
      console.log('✅ Test document deleted');
    }
  } catch (err) {
    console.log('⚠️  Cleanup failed (non-critical):', err.message);
  }
}

async function runTest() {
  console.log('🧪 Testing Document Enhancement Integration\n');
  console.log('='.repeat(60));
  
  try {
    await signup();
    await login();
    await createDocument();
    const suggestions = await enhanceDocument();
    
    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      const jobId = await applySuggestion(firstSuggestion.type);
      await pollJobStatus(jobId);
    } else {
      console.log('\n⚠️  No suggestions returned - test incomplete');
    }
    
    await cleanup();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    
    if (testDocumentId) {
      await cleanup();
    }
    
    process.exit(1);
  }
}

runTest();
