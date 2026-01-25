/**
 * Test Video Ingestion Fallback Mechanism
 * 
 * This script tests the yt-dlp + Whisper fallback when Gemini fails.
 * 
 * Prerequisites:
 * - Backend server running (npm run dev:worker)
 * - ffmpeg installed
 * - AWS Bedrock credentials configured
 * - Test video uploaded to Supabase storage
 * 
 * Usage:
 *   node tests/test_video_fallback.js
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

async function testVideoFallback() {
  console.log('\n🧪 Testing Video Ingestion Fallback Mechanism\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Get test tenant
    console.log('\n📋 Step 1: Finding test tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found. Run insert_test_tenant.js first');
      process.exit(1);
    }
    console.log(`✅ Found tenant: ${tenant.subdomain} (${tenant.id})`);

    // Step 2: Get test user
    console.log('\n📋 Step 2: Finding test user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('tenant_id', tenant.id)
      .limit(1)
      .single();

    if (userError || !user) {
      console.error('❌ Test user not found');
      process.exit(1);
    }
    console.log(`✅ Found user: ${user.email} (${user.id})`);

    // Step 3: Create a test job with a small video URL
    // Using a short test video from YouTube (public domain)
    console.log('\n📋 Step 3: Creating test video ingestion job...');
    
    const testPayload = {
      storage_path: 'test/sample_video.mp4', // Dummy path for testing
      original_filename: 'test_fallback_video.mp4',
      file_size: 1024000, // 1MB
      mimetype: 'video/mp4',
      user_id: user.id,
      youtube_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', // "Me at the zoo" - 19 second video
    };

    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: tenant.id,
        type: 'video_ingest',
        payload: testPayload,
        status: 'pending',
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      process.exit(1);
    }
    console.log(`✅ Created job: ${job.id}`);

    // Step 4: Monitor job status
    console.log('\n📋 Step 4: Monitoring job execution...');
    console.log('⏳ Waiting for worker to process job (this may take 1-2 minutes)...\n');

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes (2 second intervals)
    let jobStatus = 'pending';

    while (attempts < maxAttempts && jobStatus !== 'completed' && jobStatus !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const { data: updatedJob, error: statusError } = await supabase
        .from('job_queue')
        .select('status, result, error_message, metadata')
        .eq('id', job.id)
        .single();

      if (statusError) {
        console.error('❌ Error checking job status:', statusError);
        break;
      }

      jobStatus = updatedJob.status;
      
      if (jobStatus === 'in_progress') {
        console.log(`⏳ Job in progress... (attempt ${attempts + 1}/${maxAttempts})`);
      } else if (jobStatus === 'completed') {
        console.log('\n✅ Job completed successfully!\n');
        console.log('📊 Job Result:');
        console.log(JSON.stringify(updatedJob.result, null, 2));
        
        // Check if fallback was used
        if (updatedJob.result?.used_fallback) {
          console.log('\n🎯 FALLBACK MECHANISM TRIGGERED!');
          console.log(`   Transcription method: ${updatedJob.result.transcription_method}`);
          console.log(`   Document ID: ${updatedJob.result.document_id}`);
        } else {
          console.log('\n⚠️  Gemini succeeded - fallback was NOT triggered');
          console.log('   To test fallback, temporarily modify vertex.ts to throw an error');
        }

        // Verify document was created
        if (updatedJob.result?.document_id) {
          const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('id, title, content')
            .eq('id', updatedJob.result.document_id)
            .single();

          if (doc) {
            console.log('\n📄 Document Created:');
            console.log(`   Title: ${doc.title}`);
            console.log(`   Content length: ${doc.content.length} characters`);
            console.log(`   Preview: ${doc.content.substring(0, 200)}...`);
          }
        }

        // Check lineage event
        const { data: lineage, error: lineageError } = await supabase
          .from('document_lineage')
          .select('*')
          .eq('document_id', updatedJob.result.document_id)
          .eq('event_type', 'converted_from_video')
          .single();

        if (lineage) {
          console.log('\n📜 Lineage Event:');
          console.log(`   Used fallback: ${lineage.metadata?.used_fallback || false}`);
          console.log(`   Method: ${lineage.metadata?.transcription_method || 'unknown'}`);
        }

        break;
      } else if (jobStatus === 'failed') {
        console.log('\n❌ Job failed!\n');
        console.log('Error:', updatedJob.error_message);
        console.log('Metadata:', JSON.stringify(updatedJob.metadata, null, 2));
        break;
      }

      attempts++;
    }

    if (attempts >= maxAttempts && jobStatus === 'pending') {
      console.log('\n⏱️  Timeout: Job did not complete within 2 minutes');
      console.log('   Check if worker is running: npm run dev:worker');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testVideoFallback();
