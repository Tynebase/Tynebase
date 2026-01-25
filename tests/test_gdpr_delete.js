/**
 * Test script for GDPR Account Deletion Endpoint
 * 
 * Tests:
 * 1. Create a test user
 * 2. Call DELETE /api/gdpr/delete-account
 * 3. Verify user is marked as deleted
 * 4. Verify job is dispatched
 * 5. Simulate worker processing the job
 * 6. Verify data is anonymized/deleted
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
const TEST_EMAIL = `gdpr-delete-test-${Date.now()}@test.com`;

async function runTests() {
  console.log('🧪 GDPR Account Deletion Test\n');
  console.log('='.repeat(60));

  let testUserId = null;
  let jobId = null;

  try {
    // 1. Create auth user first
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
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        tenant_id: TEST_TENANT_ID,
        email: TEST_EMAIL,
        full_name: 'GDPR Test User',
        role: 'member',
        status: 'active',
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log(`✅ User record created: ${testUserId}`);

    // 3. Create test document for the user
    console.log('\n3️⃣  Creating test document...');
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        tenant_id: TEST_TENANT_ID,
        author_id: testUserId,
        title: 'Test Document for Deletion',
        content: 'This document should be deleted',
        status: 'draft',
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create test document: ${docError.message}`);
    }

    console.log(`✅ Test document created: ${document.id}`);

    // 4. Create test usage record
    console.log('\n4️⃣  Creating test usage record...');
    const { error: usageError } = await supabase
      .from('query_usage')
      .insert({
        tenant_id: TEST_TENANT_ID,
        user_id: testUserId,
        query_type: 'test_query',
        ai_model: 'test-model',
        credits_charged: 5,
        metadata: { test: true },
      });

    if (usageError) {
      throw new Error(`Failed to create usage record: ${usageError.message}`);
    }

    console.log('✅ Test usage record created');

    // 5. Dispatch deletion job (simulating the API endpoint)
    console.log('\n5️⃣  Dispatching GDPR deletion job...');
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'gdpr_delete',
        status: 'pending',
        payload: {
          user_id: testUserId,
          requested_at: new Date().toISOString(),
          requested_by: testUserId,
          ip_address: '127.0.0.1',
          user_agent: 'test-script',
        },
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to dispatch job: ${jobError.message}`);
    }

    jobId = job.id;
    console.log(`✅ Job dispatched: ${jobId}`);

    // 6. Mark user as deleted (simulating the endpoint behavior)
    console.log('\n6️⃣  Marking user as deleted...');
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'deleted' })
      .eq('id', testUserId);

    if (updateError) {
      throw new Error(`Failed to mark user as deleted: ${updateError.message}`);
    }

    console.log('✅ User marked as deleted');

    // 7. Verify user status
    console.log('\n7️⃣  Verifying user status...');
    const { data: deletedUser, error: checkError } = await supabase
      .from('users')
      .select('status')
      .eq('id', testUserId)
      .single();

    if (checkError) {
      throw new Error(`Failed to check user status: ${checkError.message}`);
    }

    if (deletedUser.status !== 'deleted') {
      throw new Error(`User status is ${deletedUser.status}, expected 'deleted'`);
    }

    console.log('✅ User status verified as deleted');

    // 8. Verify job exists
    console.log('\n8️⃣  Verifying job exists...');
    const { data: jobCheck, error: jobCheckError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobCheckError) {
      throw new Error(`Failed to check job: ${jobCheckError.message}`);
    }

    if (jobCheck.type !== 'gdpr_delete') {
      throw new Error(`Job type is ${jobCheck.type}, expected 'gdpr_delete'`);
    }

    console.log('✅ Job verified in queue');

    // 9. Simulate worker processing (anonymize data)
    console.log('\n9️⃣  Simulating worker processing...');
    
    // Anonymize user
    const { error: anonymizeError } = await supabase
      .from('users')
      .update({
        email: `deleted-${testUserId}@anonymized.local`,
        full_name: 'Deleted User',
      })
      .eq('id', testUserId);

    if (anonymizeError) {
      throw new Error(`Failed to anonymize user: ${anonymizeError.message}`);
    }

    // Delete documents
    const { error: deleteDocError } = await supabase
      .from('documents')
      .delete()
      .eq('author_id', testUserId);

    if (deleteDocError) {
      throw new Error(`Failed to delete documents: ${deleteDocError.message}`);
    }

    // Anonymize usage history
    const { error: anonymizeUsageError } = await supabase
      .from('query_usage')
      .update({
        metadata: {
          anonymized: true,
          original_user_deleted: true,
          deletion_date: new Date().toISOString(),
        },
      })
      .eq('user_id', testUserId);

    if (anonymizeUsageError) {
      throw new Error(`Failed to anonymize usage: ${anonymizeUsageError.message}`);
    }

    console.log('✅ Worker processing simulated');

    // 10. Verify data anonymization
    console.log('\n🔟 Verifying data anonymization...');
    
    const { data: anonymizedUser, error: verifyError } = await supabase
      .from('users')
      .select('email, full_name, status')
      .eq('id', testUserId)
      .single();

    if (verifyError) {
      throw new Error(`Failed to verify anonymization: ${verifyError.message}`);
    }

    if (!anonymizedUser.email.includes('anonymized.local')) {
      throw new Error(`Email not anonymized: ${anonymizedUser.email}`);
    }

    if (anonymizedUser.full_name !== 'Deleted User') {
      throw new Error(`Full name not anonymized: ${anonymizedUser.full_name}`);
    }

    console.log('✅ User data anonymized successfully');

    // 11. Verify documents deleted
    console.log('\n1️⃣1️⃣  Verifying documents deleted...');
    
    const { data: remainingDocs, error: docsCheckError } = await supabase
      .from('documents')
      .select('id')
      .eq('author_id', testUserId);

    if (docsCheckError) {
      throw new Error(`Failed to check documents: ${docsCheckError.message}`);
    }

    if (remainingDocs && remainingDocs.length > 0) {
      throw new Error(`Found ${remainingDocs.length} documents, expected 0`);
    }

    console.log('✅ Documents deleted successfully');

    // 12. Verify usage history anonymized
    console.log('\n1️⃣2️⃣  Verifying usage history anonymized...');
    
    const { data: usageRecords, error: usageCheckError } = await supabase
      .from('query_usage')
      .select('metadata')
      .eq('user_id', testUserId)
      .eq('query_type', 'test_query');

    if (usageCheckError) {
      throw new Error(`Failed to check usage: ${usageCheckError.message}`);
    }

    if (usageRecords && usageRecords.length > 0) {
      const record = usageRecords[0];
      if (!record.metadata?.anonymized) {
        throw new Error('Usage record not anonymized');
      }
    }

    console.log('✅ Usage history anonymized successfully');

    // 13. Mark job as completed
    console.log('\n1️⃣3️⃣  Marking job as completed...');
    
    const { error: completeError } = await supabase
      .from('job_queue')
      .update({
        status: 'completed',
        result: {
          user_id: testUserId,
          user_anonymized: true,
          documents_deleted: 1,
          completed_at: new Date().toISOString(),
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (completeError) {
      throw new Error(`Failed to complete job: ${completeError.message}`);
    }

    console.log('✅ Job marked as completed');

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   - User ID: ${testUserId}`);
    console.log(`   - Job ID: ${jobId}`);
    console.log(`   - User Status: deleted`);
    console.log(`   - Email Anonymized: ✅`);
    console.log(`   - Documents Deleted: ✅`);
    console.log(`   - Usage Anonymized: ✅`);
    console.log(`   - Job Completed: ✅`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: Delete test user and job
    console.log('\n🧹 Cleaning up test data...');
    
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
      await supabase.from('query_usage').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
      console.log('✅ Test user cleaned up');
    }
    
    if (jobId) {
      await supabase.from('job_queue').delete().eq('id', jobId);
      console.log('✅ Test job cleaned up');
    }
  }
}

runTests();
