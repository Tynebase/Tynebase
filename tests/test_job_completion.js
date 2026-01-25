require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

async function testJobCompletion() {
  console.log('\n🧪 Testing Job Completion Handlers\n');
  
  try {
    // Test 1: Create a test job
    console.log('📝 Test 1: Creating test job...');
    const { data: testJob, error: insertError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'test_job',
        status: 'processing',
        payload: { test: 'completion' },
        worker_id: 'test-worker-1'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to create test job:', insertError);
      return;
    }
    console.log('✅ Test job created:', testJob.id);

    // Test 2: Complete the job
    console.log('\n📝 Test 2: Completing job...');
    const { data: completedJob, error: completeError } = await supabase
      .from('job_queue')
      .update({
        status: 'completed',
        result: { output: 'success', tokens: 1500 },
        completed_at: new Date().toISOString()
      })
      .eq('id', testJob.id)
      .select()
      .single();

    if (completeError) {
      console.error('❌ Failed to complete job:', completeError);
      return;
    }
    console.log('✅ Job completed successfully');
    console.log('   Status:', completedJob.status);
    console.log('   Result:', JSON.stringify(completedJob.result));
    console.log('   Completed at:', completedJob.completed_at);

    // Test 3: Create a job for failure testing
    console.log('\n📝 Test 3: Creating job for failure test...');
    const { data: failJob, error: failInsertError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'test_job_fail',
        status: 'processing',
        payload: { test: 'failure' },
        worker_id: 'test-worker-2',
        attempts: 0
      })
      .select()
      .single();

    if (failInsertError) {
      console.error('❌ Failed to create fail test job:', failInsertError);
      return;
    }
    console.log('✅ Fail test job created:', failJob.id);

    // Test 4: Fail the job with retry
    console.log('\n📝 Test 4: Failing job with retry (attempt 1/3)...');
    const nextRetryAt = new Date();
    nextRetryAt.setMinutes(nextRetryAt.getMinutes() + 5);
    
    const { data: failedJob1, error: fail1Error } = await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        result: {
          error: 'API timeout',
          errorDetails: { statusCode: 504 },
          timestamp: new Date().toISOString(),
          attempts: 1
        },
        attempts: 1,
        next_retry_at: nextRetryAt.toISOString(),
        worker_id: null
      })
      .eq('id', failJob.id)
      .select()
      .single();

    if (fail1Error) {
      console.error('❌ Failed to fail job:', fail1Error);
      return;
    }
    console.log('✅ Job failed with retry scheduled');
    console.log('   Status:', failedJob1.status);
    console.log('   Attempts:', failedJob1.attempts);
    console.log('   Next retry at:', failedJob1.next_retry_at);
    console.log('   Worker ID:', failedJob1.worker_id);

    // Test 5: Permanent failure (max retries)
    console.log('\n📝 Test 5: Permanently failing job (attempt 3/3)...');
    const { data: failedJob2, error: fail2Error } = await supabase
      .from('job_queue')
      .update({
        status: 'failed',
        result: {
          error: 'Max retries exceeded',
          errorDetails: { lastError: 'Connection refused' },
          timestamp: new Date().toISOString(),
          attempts: 3
        },
        attempts: 3,
        completed_at: new Date().toISOString()
      })
      .eq('id', failJob.id)
      .select()
      .single();

    if (fail2Error) {
      console.error('❌ Failed to permanently fail job:', fail2Error);
      return;
    }
    console.log('✅ Job permanently failed');
    console.log('   Status:', failedJob2.status);
    console.log('   Attempts:', failedJob2.attempts);
    console.log('   Completed at:', failedJob2.completed_at);

    // Cleanup
    console.log('\n🧹 Cleaning up test jobs...');
    const { error: cleanupError } = await supabase
      .from('job_queue')
      .delete()
      .in('id', [testJob.id, failJob.id]);

    if (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
      return;
    }
    console.log('✅ Test jobs cleaned up');

    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

testJobCompletion();
