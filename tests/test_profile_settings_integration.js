/**
 * Integration Test: Profile Settings Update Flow
 * 
 * Tests the complete flow of updating user profile settings:
 * 1. Login as a user
 * 2. Fetch current profile via GET /api/auth/me
 * 3. Update profile via PATCH /api/auth/me
 * 4. Verify changes persisted
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testProfileSettingsIntegration() {
  console.log('🧪 Testing Profile Settings Integration...\n');

  let accessToken = null;
  let userId = null;

  try {
    // Step 1: Login
    console.log('Step 1: Login as test user...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    accessToken = loginData.data.access_token;
    userId = loginData.data.user.id;
    console.log(`✅ Login successful - User ID: ${userId}\n`);

    // Step 2: Fetch current profile
    console.log('Step 2: Fetch current profile via GET /api/auth/me...');
    const getMeResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getMeResponse.ok) {
      throw new Error(`GET /me failed: ${getMeResponse.status} ${getMeResponse.statusText}`);
    }

    const currentProfile = await getMeResponse.json();
    console.log('✅ Current profile fetched:');
    console.log(`   - Full Name: ${currentProfile.data.user.full_name || '(not set)'}`);
    console.log(`   - Email: ${currentProfile.data.user.email}\n`);

    // Step 3: Update profile
    console.log('Step 3: Update profile via PATCH /api/auth/me...');
    const newFullName = `Updated User ${Date.now()}`;
    const updateResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name: newFullName,
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`PATCH /me failed: ${updateResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Profile updated successfully');
    console.log(`   - New Full Name: ${updateData.data.user.full_name}\n`);

    // Step 4: Verify changes persisted
    console.log('Step 4: Verify changes persisted...');
    const verifyResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      throw new Error(`Verification GET /me failed: ${verifyResponse.status}`);
    }

    const verifiedProfile = await verifyResponse.json();
    
    if (verifiedProfile.data.user.full_name !== newFullName) {
      throw new Error(`Profile update not persisted! Expected: ${newFullName}, Got: ${verifiedProfile.data.user.full_name}`);
    }

    console.log('✅ Changes verified - profile update persisted correctly\n');

    // Success summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED - Profile Settings Integration Works!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ User can login');
    console.log('✓ User can fetch current profile');
    console.log('✓ User can update profile information');
    console.log('✓ Profile changes persist correctly');
    console.log('═══════════════════════════════════════════════════════\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nStack trace:', error.stack);
    return false;
  }
}

// Run the test
testProfileSettingsIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
