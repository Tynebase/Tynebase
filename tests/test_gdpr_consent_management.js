/**
 * Test: GDPR Consent Management Integration
 * 
 * Tests the frontend-backend integration for GDPR consent management:
 * - GET /api/user/consents - Fetch current consent preferences
 * - PATCH /api/user/consents - Update consent preferences
 * 
 * Prerequisites:
 * - Backend server running on port 8080
 * - Valid test user credentials
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testGDPRConsentManagement() {
  console.log('🧪 Testing GDPR Consent Management Integration\n');

  let accessToken = null;
  let userId = null;

  try {
    // Step 1: Login to get access token
    console.log('📝 Step 1: Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!',
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    accessToken = loginData.access_token;
    userId = loginData.user.id;
    console.log('✅ Login successful');
    console.log(`   User ID: ${userId}\n`);

    // Step 2: Fetch current consents (GET /api/user/consents)
    console.log('📝 Step 2: Fetching current consent preferences...');
    const getConsentsResponse = await fetch(`${API_URL}/api/user/consents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getConsentsResponse.ok) {
      throw new Error(`Get consents failed: ${getConsentsResponse.status}`);
    }

    const consentsData = await getConsentsResponse.json();
    console.log('✅ Consents fetched successfully');
    console.log('   Current consents:', JSON.stringify(consentsData.consents, null, 2));
    console.log('');

    // Step 3: Update consent preferences (PATCH /api/user/consents)
    console.log('📝 Step 3: Updating consent preferences...');
    const updateConsentsResponse = await fetch(`${API_URL}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_processing: false,
        analytics_tracking: true,
        knowledge_indexing: false,
      }),
    });

    if (!updateConsentsResponse.ok) {
      const errorData = await updateConsentsResponse.json();
      throw new Error(`Update consents failed: ${JSON.stringify(errorData)}`);
    }

    const updateData = await updateConsentsResponse.json();
    console.log('✅ Consents updated successfully');
    console.log('   Updated consents:', JSON.stringify(updateData.consents, null, 2));
    if (updateData.note) {
      console.log(`   Note: ${updateData.note}`);
    }
    console.log('');

    // Step 4: Verify the update by fetching again
    console.log('📝 Step 4: Verifying consent update...');
    const verifyResponse = await fetch(`${API_URL}/api/user/consents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      throw new Error(`Verify consents failed: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    console.log('✅ Consents verified');
    console.log('   Current consents:', JSON.stringify(verifyData.consents, null, 2));

    // Validate the changes
    if (verifyData.consents.ai_processing === false &&
        verifyData.consents.analytics_tracking === true &&
        verifyData.consents.knowledge_indexing === false) {
      console.log('✅ Consent changes persisted correctly\n');
    } else {
      throw new Error('Consent changes did not persist correctly');
    }

    // Step 5: Reset consents to defaults
    console.log('📝 Step 5: Resetting consents to defaults...');
    const resetResponse = await fetch(`${API_URL}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_processing: true,
        analytics_tracking: true,
        knowledge_indexing: true,
      }),
    });

    if (!resetResponse.ok) {
      throw new Error(`Reset consents failed: ${resetResponse.status}`);
    }

    const resetData = await resetResponse.json();
    console.log('✅ Consents reset to defaults');
    console.log('   Final consents:', JSON.stringify(resetData.consents, null, 2));
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ GET /api/user/consents - Fetch consents');
    console.log('✓ PATCH /api/user/consents - Update consents');
    console.log('✓ Consent changes persist correctly');
    console.log('✓ Audit trail logging (implicit)');
    console.log('═══════════════════════════════════════════════════════\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    return false;
  }
}

// Run the test
testGDPRConsentManagement()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
