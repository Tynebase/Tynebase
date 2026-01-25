const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

async function testClaimJob() {
  console.log('=== Testing Job Claim Function with SKIP LOCKED ===\n');

  try {
    console.log('Step 1: Inserting a test job...');
    const { data: insertedJob, error: insertError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'test_job',
        status: 'pending',
        payload: { test: 'data' }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting job:', insertError);
      return;
    }

    console.log(`✅ Job inserted: ${insertedJob.id}\n`);

    console.log('Step 2: Simulating 2 workers claiming the same job...');
    
    const worker1Id = 'worker-test-1';
    const worker2Id = 'worker-test-2';

    const [result1, result2] = await Promise.all([
      supabase.rpc('claim_job', { p_worker_id: worker1Id }),
      supabase.rpc('claim_job', { p_worker_id: worker2Id })
    ]);

    console.log('\nWorker 1 result:', result1.data);
    console.log('Worker 2 result:', result2.data);

    const worker1Claimed = result1.data && result1.data.length > 0;
    const worker2Claimed = result2.data && result2.data.length > 0;

    console.log('\n=== Results ===');
    console.log(`Worker 1 claimed job: ${worker1Claimed}`);
    console.log(`Worker 2 claimed job: ${worker2Claimed}`);

    if (worker1Claimed && !worker2Claimed) {
      console.log('\n✅ PASS: Only Worker 1 claimed the job (as expected)');
      console.log(`   Job ${result1.data[0].id} claimed by worker_id: ${result1.data[0].worker_id}`);
    } else if (!worker1Claimed && worker2Claimed) {
      console.log('\n✅ PASS: Only Worker 2 claimed the job (as expected)');
      console.log(`   Job ${result2.data[0].id} claimed by worker_id: ${result2.data[0].worker_id}`);
    } else if (worker1Claimed && worker2Claimed) {
      console.log('\n❌ FAIL: Both workers claimed a job (race condition detected!)');
    } else {
      console.log('\n❌ FAIL: Neither worker claimed the job');
    }

    console.log('\nStep 3: Verifying job status in database...');
    const { data: jobStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', insertedJob.id)
      .single();

    if (statusError) {
      console.error('Error fetching job status:', statusError);
      return;
    }

    console.log('\nFinal job state:');
    console.log(`  Status: ${jobStatus.status}`);
    console.log(`  Worker ID: ${jobStatus.worker_id}`);
    console.log(`  Attempts: ${jobStatus.attempts}`);

    if (jobStatus.status === 'processing' && jobStatus.worker_id && jobStatus.attempts === 1) {
      console.log('\n✅ VALIDATION PASSED: Job correctly claimed with SKIP LOCKED logic');
    } else {
      console.log('\n❌ VALIDATION FAILED: Job state is incorrect');
    }

    console.log('\nStep 4: Cleaning up test job...');
    await supabase.from('job_queue').delete().eq('id', insertedJob.id);
    console.log('✅ Test job deleted\n');

  } catch (error) {
    console.error('Test error:', error);
  }
}

testClaimJob();
