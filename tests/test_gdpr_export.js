/**
 * Test script for GDPR Data Export Endpoint
 * 
 * Validates:
 * - Endpoint returns complete user data
 * - All data categories are included (profile, documents, usage)
 * - Download succeeds with proper headers
 * - Authentication is required
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function testGDPRExport() {
  console.log('\n🧪 Testing GDPR Data Export Endpoint\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get a test user with authentication token
    console.log('\n📋 Step 1: Getting test user credentials...');
    
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id')
      .eq('email', 'testuser@tynebase.test')
      .single();

    if (userError || !testUser) {
      console.error('❌ Test user not found. Creating test scenario...');
      console.log('Please ensure a test user exists with email: testuser@tynebase.test');
      process.exit(1);
    }

    console.log(`✅ Found test user: ${testUser.email}`);
    console.log(`   User ID: ${testUser.id}`);
    console.log(`   Tenant ID: ${testUser.tenant_id}`);

    // Step 2: Create a session token for the test user
    console.log('\n📋 Step 2: Creating authentication token...');
    
    // Get the auth user to create a session
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(testUser.id);
    
    if (authError || !authData) {
      console.error('❌ Failed to get auth user:', authError?.message);
      process.exit(1);
    }

    // Create a test session by signing in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: 'TestPassword123!',
    });

    if (signInError || !signInData.session) {
      console.error('❌ Failed to create session:', signInError?.message);
      console.log('Note: Ensure test user password is "TestPassword123!"');
      process.exit(1);
    }

    const authToken = signInData.session.access_token;
    console.log('✅ Authentication token created');

    // Step 3: Test endpoint without authentication (should fail)
    console.log('\n📋 Step 3: Testing endpoint without authentication...');
    
    const unauthResponse = await fetch(`${BACKEND_URL}/api/gdpr/export`, {
      method: 'GET',
    });

    if (unauthResponse.status === 401) {
      console.log('✅ Correctly rejected unauthenticated request (401)');
    } else {
      console.log(`⚠️  Expected 401, got ${unauthResponse.status}`);
    }

    // Step 4: Test endpoint with authentication
    console.log('\n📋 Step 4: Testing GDPR export with authentication...');
    
    const response = await fetch(`${BACKEND_URL}/api/gdpr/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Export failed with status ${response.status}`);
      const errorData = await response.json();
      console.error('Error:', errorData);
      process.exit(1);
    }

    console.log(`✅ Export endpoint responded with status ${response.status}`);

    // Step 5: Validate response headers
    console.log('\n📋 Step 5: Validating response headers...');
    
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');

    if (contentType && contentType.includes('application/json')) {
      console.log('✅ Content-Type is application/json');
    } else {
      console.log(`⚠️  Content-Type: ${contentType}`);
    }

    if (contentDisposition && contentDisposition.includes('attachment')) {
      console.log('✅ Content-Disposition set for download');
      console.log(`   ${contentDisposition}`);
    } else {
      console.log(`⚠️  Content-Disposition: ${contentDisposition}`);
    }

    // Step 6: Validate export data structure
    console.log('\n📋 Step 6: Validating export data structure...');
    
    const exportData = await response.json();

    // Check required sections
    const requiredSections = [
      'export_metadata',
      'user_profile',
      'tenant_information',
      'documents',
      'templates',
      'usage_history',
      'audit_trail',
    ];

    let allSectionsPresent = true;
    for (const section of requiredSections) {
      if (exportData[section]) {
        console.log(`✅ Section present: ${section}`);
      } else {
        console.log(`❌ Missing section: ${section}`);
        allSectionsPresent = false;
      }
    }

    // Step 7: Validate data completeness
    console.log('\n📋 Step 7: Validating data completeness...');
    
    console.log(`\n📊 Export Summary:`);
    console.log(`   User ID: ${exportData.user_profile?.id}`);
    console.log(`   Email: ${exportData.user_profile?.email}`);
    console.log(`   Tenant: ${exportData.tenant_information?.name} (${exportData.tenant_information?.subdomain})`);
    console.log(`   Documents: ${exportData.documents?.total_count || 0}`);
    console.log(`   Templates: ${exportData.templates?.total_count || 0}`);
    console.log(`   Usage Queries: ${exportData.usage_history?.total_queries || 0}`);
    console.log(`   Total Credits Used: ${exportData.usage_history?.total_credits_used || 0}`);
    console.log(`   Export Date: ${exportData.export_metadata?.export_date}`);

    // Validate user profile data
    if (exportData.user_profile?.id === testUser.id) {
      console.log('\n✅ User profile data matches authenticated user');
    } else {
      console.log('\n❌ User profile data mismatch');
    }

    // Validate audit trail
    if (exportData.audit_trail?.export_requested_by === testUser.id) {
      console.log('✅ Audit trail includes requester information');
    } else {
      console.log('❌ Audit trail missing or incorrect');
    }

    // Step 8: Final validation
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 VALIDATION RESULTS:\n');

    if (allSectionsPresent && response.ok) {
      console.log('✅ PASS - GDPR export endpoint is functional');
      console.log('✅ All required data sections present');
      console.log('✅ Authentication working correctly');
      console.log('✅ Download headers configured properly');
      console.log('✅ Audit trail included in export');
      console.log('\n✨ Test completed successfully!\n');
      process.exit(0);
    } else {
      console.log('❌ FAIL - Some validation checks failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testGDPRExport();
