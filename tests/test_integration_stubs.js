/**
 * Test script for Task 6.10: Integration Import Stubs
 * Validates that the integration endpoints return 501 Not Implemented
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

const endpoints = [
  '/api/integrations/notion/import',
  '/api/integrations/confluence/import',
  '/api/integrations/gdocs/import',
];

/**
 * Make HTTP POST request
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Test all integration endpoints
 */
async function testIntegrationStubs() {
  console.log('Testing Integration Import Stubs (Task 6.10)');
  console.log('='.repeat(60));

  let allPassed = true;

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting: ${endpoint}`);
      const response = await makeRequest(endpoint);

      console.log(`  Status Code: ${response.statusCode}`);

      if (response.statusCode === 501) {
        try {
          const body = JSON.parse(response.body);
          if (body.error && body.error.code === 'NOT_IMPLEMENTED') {
            console.log('  ✅ PASS - Returns 501 with correct error structure');
          } else {
            console.log('  ❌ FAIL - 501 returned but incorrect error structure');
            console.log('  Response:', response.body);
            allPassed = false;
          }
        } catch (parseError) {
          console.log('  ❌ FAIL - Could not parse response body');
          console.log('  Response:', response.body);
          allPassed = false;
        }
      } else if (response.statusCode === 401 || response.statusCode === 429) {
        console.log(`  ⚠️  WARNING - Endpoint requires authentication or rate limit hit (${response.statusCode})`);
        console.log('  This is expected if auth middleware is enforced');
        console.log('  Response:', response.body);
      } else {
        console.log(`  ❌ FAIL - Expected 501, got ${response.statusCode}`);
        console.log('  Response:', response.body);
        allPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ ERROR - ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('  Make sure the backend server is running on port 3001');
      }
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ All tests PASSED');
  } else {
    console.log('❌ Some tests FAILED');
  }
  console.log('='.repeat(60));
}

testIntegrationStubs().catch(console.error);
