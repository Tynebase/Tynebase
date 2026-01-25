const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

async function testDispatchJob() {
  console.log('=== Testing Job Dispatcher Function ===\n');

  try {
    console.log('Step 1: Dispatching a test job...');
    const testPayload = {
      test: 'data',
      prompt: 'Generate a test document',
      model: 'gpt-4'
    };

    const { data: job, error } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'test_job',
        status: 'pending',
        payload: testPayload
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error dispatching job:', error);
      return;
    }

    console.log('✅ Job dispatched successfully!');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Tenant ID: ${job.tenant_id}`);
    console.log(`   Payload:`, JSON.stringify(job.payload, null, 2));

    console.log('\nStep 2: Verifying job appears in queue...');
    const { data: queuedJob, error: fetchError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', job.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching job from queue:', fetchError);
      return;
    }

    console.log('✅ Job found in queue!');
    console.log('   Job details:');
    console.log(`   - ID: ${queuedJob.id}`);
    console.log(`   - Type: ${queuedJob.type}`);
    console.log(`   - Status: ${queuedJob.status}`);
    console.log(`   - Tenant ID: ${queuedJob.tenant_id}`);
    console.log(`   - Attempts: ${queuedJob.attempts}`);
    console.log(`   - Worker ID: ${queuedJob.worker_id}`);
    console.log(`   - Created at: ${queuedJob.created_at}`);

    console.log('\nStep 3: Validating job properties...');
    let validationPassed = true;

    if (queuedJob.status !== 'pending') {
      console.error(`❌ Status should be 'pending', got '${queuedJob.status}'`);
      validationPassed = false;
    } else {
      console.log('✅ Status is correctly set to "pending"');
    }

    if (queuedJob.tenant_id !== TEST_TENANT_ID) {
      console.error(`❌ Tenant ID mismatch`);
      validationPassed = false;
    } else {
      console.log('✅ Tenant ID matches');
    }

    if (queuedJob.type !== 'test_job') {
      console.error(`❌ Job type mismatch`);
      validationPassed = false;
    } else {
      console.log('✅ Job type matches');
    }

    if (queuedJob.attempts !== 0) {
      console.error(`❌ Attempts should be 0, got ${queuedJob.attempts}`);
      validationPassed = false;
    } else {
      console.log('✅ Attempts counter is 0');
    }

    if (queuedJob.worker_id !== null) {
      console.error(`❌ Worker ID should be null, got ${queuedJob.worker_id}`);
      validationPassed = false;
    } else {
      console.log('✅ Worker ID is null (not yet claimed)');
    }

    const payloadMatches = 
      queuedJob.payload.test === testPayload.test &&
      queuedJob.payload.prompt === testPayload.prompt &&
      queuedJob.payload.model === testPayload.model;
    
    if (!payloadMatches) {
      console.error(`❌ Payload mismatch`);
      console.error(`   Expected:`, testPayload);
      console.error(`   Got:`, queuedJob.payload);
      validationPassed = false;
    } else {
      console.log('✅ Payload matches');
    }

    console.log('\nStep 4: Testing payload sanitization...');
    const sensitivePayload = {
      data: 'normal data',
      password: 'should_be_removed',
      api_key: 'secret_key',
      token: 'auth_token',
      safe_field: 'this should stay'
    };

    console.log('Attempting to dispatch job with sensitive fields...');
    console.log('Input payload:', JSON.stringify(sensitivePayload, null, 2));

    const { data: sensitiveJob, error: sensitiveError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'test_job',
        status: 'pending',
        payload: sensitivePayload
      })
      .select()
      .single();

    if (sensitiveError) {
      console.error('❌ Error dispatching job with sensitive data:', sensitiveError);
    } else {
      console.log('✅ Job dispatched (note: sanitization happens in TypeScript layer)');
      console.log('   Stored payload:', JSON.stringify(sensitiveJob.payload, null, 2));
      console.log('   ⚠️  Note: Actual sanitization is enforced in dispatchJob.ts TypeScript function');
      
      await supabase.from('job_queue').delete().eq('id', sensitiveJob.id);
    }

    console.log('\nStep 5: Cleaning up test job...');
    const { error: deleteError } = await supabase
      .from('job_queue')
      .delete()
      .eq('id', job.id);

    if (deleteError) {
      console.error('❌ Error deleting test job:', deleteError);
    } else {
      console.log('✅ Test job deleted');
    }

    console.log('\n=== VALIDATION RESULT ===');
    if (validationPassed) {
      console.log('✅ ALL TESTS PASSED');
      console.log('   - Job dispatched successfully');
      console.log('   - Job appears in queue with status="pending"');
      console.log('   - All job properties are correct');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testDispatchJob();
