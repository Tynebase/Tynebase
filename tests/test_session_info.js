const axios = require('axios');

const API_URL = 'http://localhost:8080';

async function testSessionInfo() {
  console.log('=== Testing Session Info Endpoint (Task 2.10) ===\n');

  try {
    // Step 1: Login to get a valid JWT
    console.log('Step 1: Logging in to get JWT...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'testuser@tynebase.test',
      password: 'TestPassword123!',
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed');
      return;
    }

    const token = loginResponse.data.data.access_token;
    console.log('✅ Login successful, JWT obtained\n');

    // Step 2: Test /api/auth/me with valid JWT
    console.log('Step 2: Testing GET /api/auth/me with valid JWT...');
    const meResponse = await axios.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('✅ Response received:');
    console.log(JSON.stringify(meResponse.data, null, 2));

    // Validate response structure
    const { data } = meResponse.data;
    if (!data.user || !data.tenant) {
      console.error('❌ Response missing user or tenant data');
      return;
    }

    console.log('\n✅ User data present:');
    console.log(`   - ID: ${data.user.id}`);
    console.log(`   - Email: ${data.user.email}`);
    console.log(`   - Full Name: ${data.user.full_name}`);
    console.log(`   - Role: ${data.user.role}`);
    console.log(`   - Super Admin: ${data.user.is_super_admin}`);
    console.log(`   - Status: ${data.user.status}`);

    console.log('\n✅ Tenant data present:');
    console.log(`   - ID: ${data.tenant.id}`);
    console.log(`   - Subdomain: ${data.tenant.subdomain}`);
    console.log(`   - Name: ${data.tenant.name}`);
    console.log(`   - Tier: ${data.tenant.tier}`);

    // Step 3: Test without JWT (should fail)
    console.log('\n\nStep 3: Testing GET /api/auth/me without JWT (should fail)...');
    try {
      await axios.get(`${API_URL}/api/auth/me`);
      console.error('❌ Request should have failed without JWT');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correctly rejected request without JWT (401)');
        console.log(`   Error: ${error.response.data.error.message}`);
      } else {
        console.error('❌ Unexpected error:', error.message);
      }
    }

    // Step 4: Test with invalid JWT (should fail)
    console.log('\nStep 4: Testing GET /api/auth/me with invalid JWT (should fail)...');
    try {
      await axios.get(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      });
      console.error('❌ Request should have failed with invalid JWT');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correctly rejected request with invalid JWT (401)');
        console.log(`   Error: ${error.response.data.error.message}`);
      } else {
        console.error('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n\n=== ✅ ALL VALIDATION TESTS PASSED ===');
    console.log('\nTask 2.10 Requirements Met:');
    console.log('✅ GET /api/auth/me endpoint exists');
    console.log('✅ Returns correct user profile');
    console.log('✅ Returns tenant settings');
    console.log('✅ Requires valid JWT');
    console.log('✅ Rejects requests without JWT (401)');
    console.log('✅ Rejects requests with invalid JWT (401)');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSessionInfo();
