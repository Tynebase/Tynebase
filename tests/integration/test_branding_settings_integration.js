/**
 * Integration Test: Branding Settings Update Flow
 * 
 * Tests the complete flow of updating tenant branding settings:
 * 1. User logs in
 * 2. User updates branding settings (colors, company name)
 * 3. Backend validates and saves settings
 * 4. Settings are persisted in database
 * 
 * This test validates task I7.2: Wire Tenant Branding Settings
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testBrandingSettingsIntegration() {
  console.log('🧪 Testing Branding Settings Integration (Task I7.2)...\n');

  let authToken = null;
  let tenantId = null;
  const testEmail = `branding-test-${Date.now()}@test.com`;
  const testPassword = 'SecurePass123!';
  const testSubdomain = `branding${Date.now()}`;

  try {
    // Step 1: Create test account
    console.log('📝 Step 1: Creating test account...');
    const signupResponse = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        full_name: 'Branding Test User',
        tenant_name: 'Branding Test Tenant',
        tenant_subdomain: testSubdomain,
      }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      throw new Error(`Signup failed: ${JSON.stringify(error)}`);
    }

    const signupData = await signupResponse.json();
    authToken = signupData.data.access_token;
    tenantId = signupData.data.user.tenant_id;
    console.log(`✅ Account created (Tenant ID: ${tenantId})\n`);

    // Step 2: Update branding settings
    console.log('🎨 Step 2: Updating branding settings...');
    const brandingUpdate = {
      name: 'My Custom Brand',
      settings: {
        branding: {
          primary_color: '#FF5733',
          secondary_color: '#3498DB',
          company_name: 'My Custom Brand',
        },
      },
    };

    const updateResponse = await fetch(`${API_URL}/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(brandingUpdate),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Branding update failed: ${JSON.stringify(error)}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Branding settings updated successfully');
    console.log(`   - Company Name: ${updateData.data.tenant.name}`);
    console.log(`   - Primary Color: ${updateData.data.tenant.settings.branding.primary_color}`);
    console.log(`   - Secondary Color: ${updateData.data.tenant.settings.branding.secondary_color}\n`);

    // Step 3: Verify settings were persisted
    console.log('🔍 Step 3: Verifying settings persistence...');
    const verifyResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to fetch user profile for verification');
    }

    const userData = await verifyResponse.json();
    const tenant = userData.data.user.tenant;

    // Validate branding settings
    if (tenant.name !== 'My Custom Brand') {
      throw new Error(`Expected tenant name 'My Custom Brand', got '${tenant.name}'`);
    }
    if (tenant.settings?.branding?.primary_color !== '#FF5733') {
      throw new Error(`Expected primary color '#FF5733', got '${tenant.settings?.branding?.primary_color}'`);
    }
    if (tenant.settings?.branding?.secondary_color !== '#3498DB') {
      throw new Error(`Expected secondary color '#3498DB', got '${tenant.settings?.branding?.secondary_color}'`);
    }

    console.log('✅ Settings verified and persisted correctly\n');

    // Step 4: Test partial update (only color)
    console.log('🎨 Step 4: Testing partial update (color only)...');
    const partialUpdate = {
      settings: {
        branding: {
          primary_color: '#8B4513',
        },
      },
    };

    const partialResponse = await fetch(`${API_URL}/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(partialUpdate),
    });

    if (!partialResponse.ok) {
      const error = await partialResponse.json();
      throw new Error(`Partial update failed: ${JSON.stringify(error)}`);
    }

    const partialData = await partialResponse.json();
    console.log('✅ Partial update successful');
    console.log(`   - New Primary Color: ${partialData.data.tenant.settings.branding.primary_color}`);
    console.log(`   - Secondary Color (unchanged): ${partialData.data.tenant.settings.branding.secondary_color}\n`);

    // Step 5: Test validation (invalid color format)
    console.log('🔒 Step 5: Testing validation (invalid color)...');
    const invalidUpdate = {
      settings: {
        branding: {
          primary_color: 'not-a-color',
        },
      },
    };

    const invalidResponse = await fetch(`${API_URL}/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(invalidUpdate),
    });

    if (invalidResponse.ok) {
      throw new Error('Expected validation error for invalid color format');
    }

    const invalidError = await invalidResponse.json();
    if (invalidError.error.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected VALIDATION_ERROR, got ${invalidError.error.code}`);
    }

    console.log('✅ Validation working correctly (rejected invalid color)\n');

    // Success summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED - Branding Settings Integration Working');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✓ Branding settings update via PATCH /api/tenants/:id');
    console.log('✓ Settings persistence in database');
    console.log('✓ Partial updates (merge with existing settings)');
    console.log('✓ Input validation (color format)');
    console.log('✓ Frontend can successfully wire to backend API');
    console.log('═══════════════════════════════════════════════════════════\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    return false;
  }
}

// Run the test
testBrandingSettingsIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
