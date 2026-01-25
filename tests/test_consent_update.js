/**
 * Test script for Consent Update Endpoint
 * 
 * Tests:
 * 1. Create a test user
 * 2. GET /api/user/consents (should return defaults)
 * 3. PATCH /api/user/consents (update consents)
 * 4. GET /api/user/consents (verify updated)
 * 5. PATCH with ai_processing=false
 * 6. Verify AI features would be blocked
 * 7. Verify audit trail logged
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';
const TEST_EMAIL = `consent-test-${Date.now()}@test.com`;

async function runTests() {
  console.log('🧪 Consent Update Endpoint Test\n');
  console.log('='.repeat(60));

  let testUserId = null;
  let authToken = null;

  try {
    // 1. Create auth user
    console.log('\n1️⃣  Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    testUserId = authData.user.id;
    console.log(`✅ Auth user created: ${testUserId}`);

    // 2. Create user record in public.users
    console.log('\n2️⃣  Creating user record...');
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        tenant_id: TEST_TENANT_ID,
        email: TEST_EMAIL,
        full_name: 'Consent Test User',
        role: 'member',
        status: 'active',
      });

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log(`✅ User record created`);

    // 3. Sign in to get auth token
    console.log('\n3️⃣  Signing in to get auth token...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'test-password-123',
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    authToken = signInData.session.access_token;
    console.log(`✅ Auth token obtained`);

    // 4. GET /api/user/consents (should return defaults)
    console.log('\n4️⃣  Getting default consents...');
    const getDefaultResponse = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getDefaultResponse.ok) {
      const errorText = await getDefaultResponse.text();
      throw new Error(`GET consents failed: ${getDefaultResponse.status} - ${errorText}`);
    }

    const defaultConsents = await getDefaultResponse.json();
    console.log('✅ Default consents retrieved:', JSON.stringify(defaultConsents, null, 2));

    if (defaultConsents.consents.ai_processing !== true) {
      throw new Error('Default ai_processing should be true');
    }

    // 5. PATCH /api/user/consents (update analytics_tracking to false)
    console.log('\n5️⃣  Updating consents (analytics_tracking=false)...');
    const patchResponse1 = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analytics_tracking: false,
      }),
    });

    if (!patchResponse1.ok) {
      const errorText = await patchResponse1.text();
      throw new Error(`PATCH consents failed: ${patchResponse1.status} - ${errorText}`);
    }

    const updatedConsents1 = await patchResponse1.json();
    console.log('✅ Consents updated:', JSON.stringify(updatedConsents1, null, 2));

    if (updatedConsents1.consents.analytics_tracking !== false) {
      throw new Error('analytics_tracking should be false');
    }

    if (updatedConsents1.consents.ai_processing !== true) {
      throw new Error('ai_processing should still be true');
    }

    // 6. GET /api/user/consents (verify updated)
    console.log('\n6️⃣  Verifying updated consents...');
    const getUpdatedResponse = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getUpdatedResponse.ok) {
      const errorText = await getUpdatedResponse.text();
      throw new Error(`GET updated consents failed: ${getUpdatedResponse.status} - ${errorText}`);
    }

    const verifiedConsents = await getUpdatedResponse.json();
    console.log('✅ Verified consents:', JSON.stringify(verifiedConsents, null, 2));

    if (verifiedConsents.consents.analytics_tracking !== false) {
      throw new Error('analytics_tracking should be false after update');
    }

    // 7. PATCH with ai_processing=false
    console.log('\n7️⃣  Disabling AI processing...');
    const patchResponse2 = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_processing: false,
      }),
    });

    if (!patchResponse2.ok) {
      const errorText = await patchResponse2.text();
      throw new Error(`PATCH ai_processing failed: ${patchResponse2.status} - ${errorText}`);
    }

    const updatedConsents2 = await patchResponse2.json();
    console.log('✅ AI processing disabled:', JSON.stringify(updatedConsents2, null, 2));

    if (updatedConsents2.consents.ai_processing !== false) {
      throw new Error('ai_processing should be false');
    }

    if (!updatedConsents2.note || !updatedConsents2.note.includes('AI processing disabled')) {
      throw new Error('Should include warning note about AI processing disabled');
    }

    // 8. Verify consents in database
    console.log('\n8️⃣  Verifying consents in database...');
    const { data: dbConsents, error: dbError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    if (dbError) {
      throw new Error(`Failed to fetch consents from DB: ${dbError.message}`);
    }

    if (dbConsents.ai_processing !== false) {
      throw new Error('DB: ai_processing should be false');
    }

    if (dbConsents.analytics_tracking !== false) {
      throw new Error('DB: analytics_tracking should be false');
    }

    console.log('✅ Database consents verified');

    // 9. Verify audit trail
    console.log('\n9️⃣  Verifying audit trail...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('query_usage')
      .select('*')
      .eq('user_id', testUserId)
      .eq('query_type', 'consent_update')
      .order('created_at', { ascending: false });

    if (auditError) {
      throw new Error(`Failed to fetch audit logs: ${auditError.message}`);
    }

    if (!auditLogs || auditLogs.length < 2) {
      throw new Error(`Expected at least 2 audit log entries, found ${auditLogs?.length || 0}`);
    }

    console.log(`✅ Audit trail verified (${auditLogs.length} consent updates logged)`);

    // 10. Test validation - empty body
    console.log('\n🔟 Testing validation (empty body)...');
    const patchResponse3 = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (patchResponse3.ok) {
      throw new Error('Empty body should fail validation');
    }

    if (patchResponse3.status !== 400) {
      throw new Error(`Expected 400 status for empty body, got ${patchResponse3.status}`);
    }

    console.log('✅ Validation working (empty body rejected)');

    // 11. Test validation - invalid type
    console.log('\n1️⃣1️⃣  Testing validation (invalid type)...');
    const patchResponse4 = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/api/user/consents`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ai_processing: 'not-a-boolean',
      }),
    });

    if (patchResponse4.ok) {
      throw new Error('Invalid type should fail validation');
    }

    if (patchResponse4.status !== 400) {
      throw new Error(`Expected 400 status for invalid type, got ${patchResponse4.status}`);
    }

    console.log('✅ Validation working (invalid type rejected)');

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   - User ID: ${testUserId}`);
    console.log(`   - Default Consents: ✅`);
    console.log(`   - Update Consents: ✅`);
    console.log(`   - Verify Updates: ✅`);
    console.log(`   - AI Processing Disabled: ✅`);
    console.log(`   - Database Verified: ✅`);
    console.log(`   - Audit Trail: ✅ (${auditLogs.length} entries)`);
    console.log(`   - Validation: ✅`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    if (testUserId) {
      await supabase.from('user_consents').delete().eq('user_id', testUserId);
      await supabase.from('query_usage').delete().eq('user_id', testUserId);
      await supabase.from('users').delete().eq('id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
      console.log('✅ Test user cleaned up');
    }
  }
}

runTests();
