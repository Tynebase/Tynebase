/**
 * Integration Test: URL Scraping Flow
 * 
 * Tests the complete URL scraping workflow:
 * 1. POST /api/ai/scrape with URL
 * 2. Poll job status until completion
 * 3. Verify markdown content is returned
 * 
 * Prerequisites:
 * - Backend server running on http://localhost:8080
 * - Valid JWT token with tenant context
 * - Test tenant and user created
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

// Test configuration
const TEST_URL = 'https://example.com'; // Simple test URL
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 30; // 60 seconds max

let authToken = '';
let tenantSubdomain = '';

/**
 * Helper: Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': authToken ? `Bearer ${authToken}` : '',
    'x-tenant-subdomain': tenantSubdomain,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return data;
}

/**
 * Helper: Poll job status until completion
 */
async function pollJobStatus(jobId) {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const response = await apiRequest(`/api/jobs/${jobId}`);
    const job = response.data.job;

    console.log(`  [Poll ${attempts + 1}] Job status: ${job.status}, progress: ${job.progress || 0}%`);

    if (job.status === 'completed') {
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(`Job failed: ${job.error_message}`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    attempts++;
  }

  throw new Error('Job polling timeout - max attempts reached');
}

/**
 * Test 1: Scrape URL and verify markdown output
 */
async function testUrlScraping() {
  console.log('\n=== Test 1: URL Scraping ===');

  console.log(`1. Submitting URL scraping job: ${TEST_URL}`);
  const scrapeResponse = await apiRequest('/api/ai/scrape', {
    method: 'POST',
    body: JSON.stringify({ url: TEST_URL }),
  });

  console.log('✓ Scraping job created');
  console.log(`  Job ID: ${scrapeResponse.data.job.id}`);
  console.log(`  Status: ${scrapeResponse.data.job.status}`);

  console.log('\n2. Polling job status...');
  const completedJob = await pollJobStatus(scrapeResponse.data.job.id);

  console.log('✓ Job completed successfully');
  console.log(`  Result keys: ${Object.keys(completedJob.result || {}).join(', ')}`);

  if (!completedJob.result?.markdown) {
    throw new Error('Job result does not contain markdown content');
  }

  console.log('✓ Markdown content extracted');
  console.log(`  Content length: ${completedJob.result.markdown.length} characters`);
  console.log(`  Preview: ${completedJob.result.markdown.substring(0, 100)}...`);

  return completedJob;
}

/**
 * Test 2: Verify error handling for invalid URL
 */
async function testInvalidUrl() {
  console.log('\n=== Test 2: Invalid URL Error Handling ===');

  try {
    console.log('1. Submitting invalid URL');
    await apiRequest('/api/ai/scrape', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-valid-url' }),
    });

    throw new Error('Expected validation error but request succeeded');
  } catch (err) {
    if (err.message.includes('Expected validation error')) {
      throw err;
    }
    console.log('✓ Invalid URL rejected as expected');
    console.log(`  Error: ${err.message}`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       URL Scraping Integration Test                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Setup: Login and get auth token
    console.log('\n📋 Setup: Authenticating...');
    const loginResponse = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!',
      }),
    });

    authToken = loginResponse.data.access_token;
    tenantSubdomain = loginResponse.data.user.tenant_subdomain;

    console.log('✓ Authentication successful');
    console.log(`  Tenant: ${tenantSubdomain}`);

    // Run tests
    await testUrlScraping();
    await testInvalidUrl();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ALL TESTS PASSED                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\nURL Scraping Integration: WORKING ✓');

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ TEST FAILED                          ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
