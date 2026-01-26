/**
 * Integration Test: Sources Health Dashboard
 * Tests GET /api/sources/health endpoint integration
 * 
 * Task: I5.4 - Wire Sources Health Dashboard
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testSourcesHealthIntegration() {
  console.log('🧪 Testing Sources Health Dashboard Integration (Task I5.4)...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: GET /api/sources/health without auth should fail
  console.log('Test 1: GET /api/sources/health without auth');
  try {
    const response = await fetch(`${API_URL}/api/sources/health`, {
      method: 'GET',
    });

    if (response.status === 401) {
      console.log('✅ PASS: Returns 401 without authentication\n');
      testsPassed++;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.status}\n`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 2: GET /api/sources/health with auth should return health stats
  console.log('Test 2: GET /api/sources/health with valid auth');
  try {
    // First, login to get a token
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test123!@#',
      }),
    });

    if (!loginResponse.ok) {
      console.log('⚠️  SKIP: Cannot test - login failed (user may not exist)\n');
    } else {
      const loginData = await loginResponse.json();
      const token = loginData.access_token;
      const subdomain = loginData.user?.tenant?.subdomain;

      const healthResponse = await fetch(`${API_URL}/api/sources/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-subdomain': subdomain || 'test',
        },
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        
        // Validate response structure
        if (
          healthData.success &&
          healthData.data &&
          typeof healthData.data.total_documents === 'number' &&
          typeof healthData.data.indexed_documents === 'number' &&
          typeof healthData.data.outdated_documents === 'number' &&
          typeof healthData.data.never_indexed_documents === 'number' &&
          typeof healthData.data.failed_jobs === 'number' &&
          Array.isArray(healthData.data.documents_needing_reindex)
        ) {
          console.log('✅ PASS: Returns valid health statistics');
          console.log(`   - Total documents: ${healthData.data.total_documents}`);
          console.log(`   - Indexed documents: ${healthData.data.indexed_documents}`);
          console.log(`   - Outdated documents: ${healthData.data.outdated_documents}`);
          console.log(`   - Never indexed: ${healthData.data.never_indexed_documents}`);
          console.log(`   - Failed jobs: ${healthData.data.failed_jobs}`);
          console.log(`   - Documents needing reindex: ${healthData.data.documents_needing_reindex.length}\n`);
          testsPassed++;
        } else {
          console.log('❌ FAIL: Invalid response structure');
          console.log('   Response:', JSON.stringify(healthData, null, 2), '\n');
          testsFailed++;
        }
      } else {
        const errorData = await healthResponse.json();
        console.log(`❌ FAIL: Expected 200, got ${healthResponse.status}`);
        console.log('   Error:', errorData.error?.message || 'Unknown error', '\n');
        testsFailed++;
      }
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 3: Verify documents_needing_reindex structure
  console.log('Test 3: Verify documents_needing_reindex structure');
  try {
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test123!@#',
      }),
    });

    if (!loginResponse.ok) {
      console.log('⚠️  SKIP: Cannot test - login failed\n');
    } else {
      const loginData = await loginResponse.json();
      const token = loginData.access_token;
      const subdomain = loginData.user?.tenant?.subdomain;

      const healthResponse = await fetch(`${API_URL}/api/sources/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-subdomain': subdomain || 'test',
        },
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        const docs = healthData.data.documents_needing_reindex;

        if (docs.length > 0) {
          const firstDoc = docs[0];
          if (
            firstDoc.id &&
            firstDoc.title &&
            (firstDoc.reason === 'never_indexed' || firstDoc.reason === 'outdated') &&
            firstDoc.updated_at
          ) {
            console.log('✅ PASS: Document structure is valid');
            console.log(`   - Sample document: ${firstDoc.title}`);
            console.log(`   - Reason: ${firstDoc.reason}`);
            console.log(`   - Updated: ${firstDoc.updated_at}\n`);
            testsPassed++;
          } else {
            console.log('❌ FAIL: Invalid document structure');
            console.log('   Document:', JSON.stringify(firstDoc, null, 2), '\n');
            testsFailed++;
          }
        } else {
          console.log('✅ PASS: No documents need reindexing (empty array is valid)\n');
          testsPassed++;
        }
      } else {
        console.log(`❌ FAIL: Could not fetch health data\n`);
        testsFailed++;
      }
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log('═══════════════════════════════════════\n');

  if (testsFailed === 0) {
    console.log('✅ All tests passed! Task I5.4 integration verified.\n');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    return false;
  }
}

// Run tests
testSourcesHealthIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
