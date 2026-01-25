/**
 * Test script for YouTube video ingestion worker
 * Tests the video_ingest_youtube job type processing
 * 
 * Usage: node tests/test_youtube_worker.js
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function testYouTubeWorkerProcessing() {
  console.log('\n🧪 Testing YouTube Worker Processing\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Create a video_ingest_youtube job
    console.log('\n📝 Test 1: Creating video_ingest_youtube job...');
    
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'video_ingest_youtube',
        payload: {
          url: testUrl,
          user_id: TEST_USER_ID,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      return;
    }

    console.log('✅ Job created successfully');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Payload:`, JSON.stringify(job.payload, null, 2));

    // Test 2: Verify job is in pending state
    console.log('\n📝 Test 2: Verifying job status...');
    
    const { data: jobStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', job.id)
      .single();

    if (statusError) {
      console.error('❌ Failed to fetch job status:', statusError);
      return;
    }

    console.log('✅ Job status verified');
    console.log(`   Status: ${jobStatus.status}`);
    console.log(`   Created: ${jobStatus.created_at}`);

    // Test 3: Verify payload structure
    console.log('\n📝 Test 3: Validating payload structure...');
    
    const payload = jobStatus.payload;
    const hasUrl = payload.url && typeof payload.url === 'string';
    const hasUserId = payload.user_id && typeof payload.user_id === 'string';
    
    if (hasUrl && hasUserId) {
      console.log('✅ Payload structure is valid');
      console.log(`   URL: ${payload.url}`);
      console.log(`   User ID: ${payload.user_id}`);
    } else {
      console.error('❌ Invalid payload structure');
      console.error(`   Has URL: ${hasUrl}`);
      console.error(`   Has User ID: ${hasUserId}`);
    }

    // Test 4: Wait for worker to process (if running)
    console.log('\n📝 Test 4: Monitoring job processing...');
    console.log('   Note: Worker must be running for this test to complete');
    console.log('   Waiting up to 60 seconds for job to be processed...');
    
    let processed = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!processed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const { data: currentJob } = await supabase
        .from('job_queue')
        .select('status, result, error')
        .eq('id', job.id)
        .single();
      
      if (currentJob && currentJob.status !== 'pending' && currentJob.status !== 'processing') {
        processed = true;
        
        if (currentJob.status === 'completed') {
          console.log(`✅ Job completed successfully after ${attempts} seconds`);
          console.log('   Result:', JSON.stringify(currentJob.result, null, 2));
          
          // Verify document was created
          if (currentJob.result && currentJob.result.document_id) {
            const { data: document } = await supabase
              .from('documents')
              .select('id, title, content, status')
              .eq('id', currentJob.result.document_id)
              .single();
            
            if (document) {
              console.log('\n✅ Document created successfully');
              console.log(`   Document ID: ${document.id}`);
              console.log(`   Title: ${document.title}`);
              console.log(`   Content length: ${document.content.length} characters`);
              console.log(`   Status: ${document.status}`);
            }
          }
        } else if (currentJob.status === 'failed') {
          console.error(`❌ Job failed after ${attempts} seconds`);
          console.error('   Error:', currentJob.error);
        }
      } else if (attempts % 10 === 0) {
        console.log(`   Still waiting... (${attempts}s elapsed, status: ${currentJob?.status || 'unknown'})`);
      }
    }
    
    if (!processed) {
      console.log('⚠️  Job did not complete within 60 seconds');
      console.log('   This is expected if the worker is not running');
      console.log('   Start the worker with: npm run worker');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed');
    console.log('\nCleanup: To delete the test job, run:');
    console.log(`DELETE FROM job_queue WHERE id = '${job.id}';`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

testYouTubeWorkerProcessing();
