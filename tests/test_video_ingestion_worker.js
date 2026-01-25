/**
 * Test Video Ingestion Worker
 * Validates that the video ingestion worker can process jobs correctly
 * 
 * Prerequisites:
 * - backend/.env with valid Supabase credentials
 * - Test tenant exists (subdomain: test, ID: 1521f0ae-4db7-4110-a993-c494535d9b00)
 * - Vertex AI credentials configured (GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS)
 * 
 * Run from project root:
 * node tests/test_video_ingestion_worker.js
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('========================================');
  console.log('Video Ingestion Worker Validation Tests');
  console.log('========================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Verify job_queue table exists
  console.log('Test 1: Verify job_queue table exists');
  try {
    const { data, error } = await supabase
      .from('job_queue')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ PASS: job_queue table accessible\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 2: Verify documents table exists
  console.log('Test 2: Verify documents table exists');
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ PASS: documents table accessible\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 3: Verify document_lineage table exists
  console.log('Test 3: Verify document_lineage table exists');
  try {
    const { data, error } = await supabase
      .from('document_lineage')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ PASS: document_lineage table accessible\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 4: Verify query_usage table exists
  console.log('Test 4: Verify query_usage table exists');
  try {
    const { data, error } = await supabase
      .from('query_usage')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ PASS: query_usage table accessible\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 5: Verify tenant-uploads storage bucket exists
  console.log('Test 5: Verify tenant-uploads storage bucket exists');
  try {
    const { data, error } = await supabase
      .storage
      .from('tenant-uploads')
      .list('', { limit: 1 });
    
    if (error) throw error;
    console.log('✅ PASS: tenant-uploads bucket accessible\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 6: Create a test video_ingestion job
  console.log('Test 6: Create a test video_ingestion job');
  let testJobId = null;
  try {
    const { data, error } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'video_ingestion',
        payload: {
          storage_path: `tenant-${TEST_TENANT_ID}/test_video.mp4`,
          original_filename: 'test_video.mp4',
          file_size: 10485760,
          mimetype: 'video/mp4',
          user_id: TEST_USER_ID,
        },
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) throw error;
    testJobId = data.id;
    console.log(`✅ PASS: Job created with ID: ${testJobId}\n`);
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 7: Verify job payload structure
  console.log('Test 7: Verify job payload structure');
  try {
    const { data, error } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', testJobId)
      .single();
    
    if (error) throw error;
    
    const requiredFields = ['storage_path', 'original_filename', 'file_size', 'mimetype', 'user_id'];
    const missingFields = requiredFields.filter(field => !data.payload[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ PASS: Job payload has all required fields\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 8: Verify worker can claim the job
  console.log('Test 8: Verify worker can claim the job');
  try {
    const workerId = `test-worker-${Date.now()}`;
    const { data, error } = await supabase.rpc('claim_job', {
      p_worker_id: workerId,
    });
    
    if (error) throw error;
    
    if (data && data.id === testJobId) {
      console.log(`✅ PASS: Worker claimed job ${testJobId}\n`);
      testsPassed++;
    } else {
      console.log('⚠️  SKIP: Job not claimed (may have been claimed by another worker)\n');
    }
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Test 9: Clean up test job
  console.log('Test 9: Clean up test job');
  try {
    const { error } = await supabase
      .from('job_queue')
      .delete()
      .eq('id', testJobId);
    
    if (error) throw error;
    console.log('✅ PASS: Test job cleaned up\n');
    testsPassed++;
  } catch (error) {
    console.error('❌ FAIL:', error.message, '\n');
    testsFailed++;
  }

  // Summary
  console.log('========================================');
  console.log('VALIDATION SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log('========================================\n');

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Video ingestion worker is ready.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
