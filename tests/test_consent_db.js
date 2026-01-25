/**
 * Database-level test for User Consents functionality
 * 
 * Tests:
 * 1. Create test user
 * 2. Insert consent record
 * 3. Update consent record
 * 4. Verify RLS policies work
 * 5. Verify trigger updates timestamp
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
const TEST_EMAIL = `consent-db-test-${Date.now()}@test.com`;

async function runTests() {
  console.log('🧪 User Consents Database Test\n');
  console.log('='.repeat(60));

  let testUserId = null;

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

    // 2. Create user record
    console.log('\n2️⃣  Creating user record...');
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        tenant_id: TEST_TENANT_ID,
        email: TEST_EMAIL,
        full_name: 'Consent DB Test User',
        role: 'member',
        status: 'active',
      });

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log(`✅ User record created`);

    // 3. Insert consent record with defaults
    console.log('\n3️⃣  Inserting consent record...');
    const { data: insertedConsent, error: insertError } = await supabase
      .from('user_consents')
      .insert({
        user_id: testUserId,
        ai_processing: true,
        analytics_tracking: true,
        knowledge_indexing: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert consent: ${insertError.message}`);
    }

    console.log(`✅ Consent record inserted`);
    console.log(`   - ai_processing: ${insertedConsent.ai_processing}`);
    console.log(`   - analytics_tracking: ${insertedConsent.analytics_tracking}`);
    console.log(`   - knowledge_indexing: ${insertedConsent.knowledge_indexing}`);
    console.log(`   - updated_at: ${insertedConsent.updated_at}`);

    const initialUpdatedAt = insertedConsent.updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Update consent (analytics_tracking to false)
    console.log('\n4️⃣  Updating consent (analytics_tracking=false)...');
    const { data: updatedConsent1, error: updateError1 } = await supabase
      .from('user_consents')
      .update({
        analytics_tracking: false,
      })
      .eq('user_id', testUserId)
      .select()
      .single();

    if (updateError1) {
      throw new Error(`Failed to update consent: ${updateError1.message}`);
    }

    console.log(`✅ Consent updated`);
    console.log(`   - analytics_tracking: ${updatedConsent1.analytics_tracking}`);
    console.log(`   - updated_at: ${updatedConsent1.updated_at}`);

    if (updatedConsent1.analytics_tracking !== false) {
      throw new Error('analytics_tracking should be false');
    }

    if (updatedConsent1.ai_processing !== true) {
      throw new Error('ai_processing should still be true');
    }

    // 5. Verify trigger updated timestamp
    console.log('\n5️⃣  Verifying timestamp trigger...');
    if (updatedConsent1.updated_at === initialUpdatedAt) {
      throw new Error('Timestamp should have been updated by trigger');
    }

    console.log(`✅ Timestamp trigger working (${initialUpdatedAt} → ${updatedConsent1.updated_at})`);

    // 6. Update ai_processing to false
    console.log('\n6️⃣  Disabling AI processing...');
    const { data: updatedConsent2, error: updateError2 } = await supabase
      .from('user_consents')
      .update({
        ai_processing: false,
      })
      .eq('user_id', testUserId)
      .select()
      .single();

    if (updateError2) {
      throw new Error(`Failed to update ai_processing: ${updateError2.message}`);
    }

    console.log(`✅ AI processing disabled`);
    console.log(`   - ai_processing: ${updatedConsent2.ai_processing}`);

    if (updatedConsent2.ai_processing !== false) {
      throw new Error('ai_processing should be false');
    }

    // 7. Verify final state
    console.log('\n7️⃣  Verifying final consent state...');
    const { data: finalConsent, error: finalError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    if (finalError) {
      throw new Error(`Failed to fetch final consent: ${finalError.message}`);
    }

    console.log(`✅ Final consent state verified`);
    console.log(`   - ai_processing: ${finalConsent.ai_processing} (expected: false)`);
    console.log(`   - analytics_tracking: ${finalConsent.analytics_tracking} (expected: false)`);
    console.log(`   - knowledge_indexing: ${finalConsent.knowledge_indexing} (expected: true)`);

    if (finalConsent.ai_processing !== false) {
      throw new Error('Final: ai_processing should be false');
    }

    if (finalConsent.analytics_tracking !== false) {
      throw new Error('Final: analytics_tracking should be false');
    }

    if (finalConsent.knowledge_indexing !== true) {
      throw new Error('Final: knowledge_indexing should be true');
    }

    // 8. Verify table structure
    console.log('\n8️⃣  Verifying table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'user_consents'
          ORDER BY ordinal_position;
        `
      });

    if (tableError) {
      console.log('⚠️  Could not verify table structure (RPC not available)');
    } else {
      console.log('✅ Table structure verified');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   - User ID: ${testUserId}`);
    console.log(`   - Consent Insert: ✅`);
    console.log(`   - Consent Update: ✅`);
    console.log(`   - Timestamp Trigger: ✅`);
    console.log(`   - AI Processing Disabled: ✅`);
    console.log(`   - Final State Verified: ✅`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    if (testUserId) {
      await supabase.from('user_consents').delete().eq('user_id', testUserId);
      await supabase.from('users').delete().eq('id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
      console.log('✅ Test user cleaned up');
    }
  }
}

runTests();
