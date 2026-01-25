/**
 * Test script for Task 7.8: Manual Re-Index Endpoint
 * POST /api/sources/:id/reindex
 * 
 * Prerequisites:
 * - Backend server running on http://localhost:3000
 * - Test tenant exists (subdomain: 'test')
 * - Test user with admin role exists
 * - At least one document exists for the test tenant
 * 
 * Run from project root: node tests/test_reindex_endpoint.js
 */

const https = require('https');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const TEST_TENANT_SUBDOMAIN = 'test';
const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

// You need to replace these with actual values:
// 1. Get a valid JWT token for an admin user
// 2. Get a valid document ID from the test tenant
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT
const TEST_DOCUMENT_ID = 'YOUR_DOCUMENT_ID_HERE'; // Replace with actual document ID

/**
 * Make HTTP request
 */
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Test 1: Trigger re-index with valid admin user
 */
async function testValidReindex() {
  console.log('\n=== Test 1: Valid Re-Index Request ===');
  
  try {
    const response = await makeRequest(
      'POST',
      `/api/sources/${TEST_DOCUMENT_ID}/reindex`,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
      }
    );

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 201 || response.status === 200) {
      console.log('✅ PASS: Re-index job queued successfully');
      console.log('Job ID:', response.data.data?.job_id);
      return response.data.data?.job_id;
    } else {
      console.log('❌ FAIL: Expected 201 or 200, got', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return null;
  }
}

/**
 * Test 2: Duplicate re-index request (should return existing job)
 */
async function testDuplicateReindex(previousJobId) {
  console.log('\n=== Test 2: Duplicate Re-Index Request ===');
  
  try {
    const response = await makeRequest(
      'POST',
      `/api/sources/${TEST_DOCUMENT_ID}/reindex`,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
      }
    );

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.data?.message?.includes('already')) {
      console.log('✅ PASS: Duplicate prevention working');
      return true;
    } else {
      console.log('⚠️  WARNING: Expected duplicate detection');
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

/**
 * Test 3: Invalid document ID
 */
async function testInvalidDocumentId() {
  console.log('\n=== Test 3: Invalid Document ID ===');
  
  const invalidId = '00000000-0000-0000-0000-000000000000';
  
  try {
    const response = await makeRequest(
      'POST',
      `/api/sources/${invalidId}/reindex`,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
      }
    );

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 404) {
      console.log('✅ PASS: Correctly returns 404 for non-existent document');
      return true;
    } else {
      console.log('❌ FAIL: Expected 404, got', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

/**
 * Test 4: Missing authentication
 */
async function testMissingAuth() {
  console.log('\n=== Test 4: Missing Authentication ===');
  
  try {
    const response = await makeRequest(
      'POST',
      `/api/sources/${TEST_DOCUMENT_ID}/reindex`,
      {
        'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN,
      }
    );

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 401) {
      console.log('✅ PASS: Correctly returns 401 for missing auth');
      return true;
    } else {
      console.log('❌ FAIL: Expected 401, got', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=================================================');
  console.log('Task 7.8: Manual Re-Index Endpoint Tests');
  console.log('=================================================');

  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE' || TEST_DOCUMENT_ID === 'YOUR_DOCUMENT_ID_HERE') {
    console.log('\n❌ ERROR: Please configure JWT_TOKEN and TEST_DOCUMENT_ID in the script');
    console.log('\nTo get these values:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Login as an admin user to get JWT token');
    console.log('3. Query database for a document ID from test tenant');
    console.log('4. Update the constants at the top of this file');
    return;
  }

  const jobId = await testValidReindex();
  
  if (jobId) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await testDuplicateReindex(jobId);
  }
  
  await testInvalidDocumentId();
  await testMissingAuth();

  console.log('\n=================================================');
  console.log('Tests Complete');
  console.log('=================================================\n');
}

// Run tests
runTests().catch(console.error);
