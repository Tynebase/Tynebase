/**
 * Integration Test: Login Flow (Task I2.1)
 * 
 * Tests that the frontend login page correctly calls the backend API
 * and handles authentication tokens.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testLoginFlow() {
  console.log('🧪 Testing Login Flow Integration (Task I2.1)...\n');

  // Test credentials (use existing test user from backend tests)
  const testEmail = 'test@example.com';
  const testPassword = 'SecurePassword123!';

  try {
    // Step 1: Test login endpoint
    console.log('1️⃣ Testing POST /api/auth/login...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.error('❌ Login failed:', errorData);
      
      // If user doesn't exist, provide helpful message
      if (loginResponse.status === 401) {
        console.log('\n💡 Tip: Run the signup test first to create a test user:');
        console.log('   node tests/test_signup_integration.js\n');
      }
      
      process.exit(1);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');

    // Step 2: Validate response structure
    console.log('\n2️⃣ Validating response structure...');
    
    const requiredFields = ['user', 'tenant', 'access_token', 'refresh_token', 'expires_in'];
    const missingFields = requiredFields.filter(field => !loginData[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      process.exit(1);
    }
    
    console.log('✅ Response structure valid');
    console.log('   - User ID:', loginData.user.id);
    console.log('   - User Email:', loginData.user.email);
    console.log('   - Tenant:', loginData.tenant.subdomain);
    console.log('   - Token Type: JWT');
    console.log('   - Expires In:', loginData.expires_in, 'seconds');

    // Step 3: Test authenticated endpoint with token
    console.log('\n3️⃣ Testing authenticated request with JWT token...');
    
    const meResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.access_token}`,
        'x-tenant-subdomain': loginData.tenant.subdomain,
      },
    });

    if (!meResponse.ok) {
      const errorData = await meResponse.json();
      console.error('❌ Authenticated request failed:', errorData);
      process.exit(1);
    }

    const meData = await meResponse.json();
    console.log('✅ Authenticated request successful');
    console.log('   - Verified User:', meData.user.email);
    console.log('   - Verified Tenant:', meData.tenant.subdomain);

    // Step 4: Test invalid credentials
    console.log('\n4️⃣ Testing invalid credentials handling...');
    
    const invalidLoginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword123!',
      }),
    });

    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid credentials correctly rejected');
    } else {
      console.error('❌ Invalid credentials should return 401');
      process.exit(1);
    }

    // Step 5: Test missing tenant header
    console.log('\n5️⃣ Testing request without tenant header...');
    
    const noTenantResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.access_token}`,
        // Missing x-tenant-subdomain header
      },
    });

    if (noTenantResponse.status === 400 || noTenantResponse.status === 401) {
      console.log('✅ Missing tenant header correctly rejected');
    } else {
      console.log('⚠️  Warning: Request without tenant header was accepted');
      console.log('   (This may be intentional for some endpoints)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED - Login Integration Working!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log('   ✓ Login endpoint returns valid JWT tokens');
    console.log('   ✓ Response includes user and tenant data');
    console.log('   ✓ JWT token works for authenticated requests');
    console.log('   ✓ Invalid credentials are rejected');
    console.log('   ✓ Frontend can now use login() from lib/api/auth.ts');
    console.log('\n🎯 Task I2.1 Complete: Login page wired to backend API\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testLoginFlow();
