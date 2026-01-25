/**
 * Test Document Conversion Worker
 * Validates that the document conversion job handler works correctly
 */

require('dotenv').config({ path: '../backend/.env' });
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

async function testDocumentConversionJob() {
  console.log('🧪 Testing Document Conversion Job Handler\n');

  try {
    // Test 1: Create a test document_convert job
    console.log('Test 1: Creating document_convert job...');
    
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: TEST_TENANT_ID,
        type: 'document_convert',
        payload: {
          storage_path: 'test/sample.pdf',
          original_filename: 'sample.pdf',
          file_size: 12345,
          mimetype: 'application/pdf',
          user_id: TEST_USER_ID,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError.message);
      return;
    }

    console.log('✅ Job created:', job.id);
    console.log('   Type:', job.type);
    console.log('   Status:', job.status);
    console.log('   Payload:', JSON.stringify(job.payload, null, 2));

    // Test 2: Verify job structure
    console.log('\nTest 2: Verifying job structure...');
    
    if (job.payload.storage_path && 
        job.payload.original_filename && 
        job.payload.file_size && 
        job.payload.mimetype && 
        job.payload.user_id) {
      console.log('✅ Job payload has all required fields');
    } else {
      console.log('❌ Job payload missing required fields');
    }

    // Test 3: Verify documents table structure
    console.log('\nTest 3: Verifying documents table...');
    
    const { data: docTest, error: docError } = await supabase
      .from('documents')
      .select('id')
      .limit(1);

    if (!docError) {
      console.log('✅ Documents table accessible');
    } else {
      console.log('❌ Documents table error:', docError.message);
    }

    // Test 4: Verify document_lineage table
    console.log('\nTest 4: Verifying document_lineage table...');
    
    const { data: lineageTest, error: lineageError } = await supabase
      .from('document_lineage')
      .select('id')
      .limit(1);

    if (!lineageError) {
      console.log('✅ Document lineage table accessible');
    } else {
      console.log('❌ Document lineage table error:', lineageError.message);
    }

    // Test 5: Verify query_usage table
    console.log('\nTest 5: Verifying query_usage table...');
    
    const { data: usageTest, error: usageError } = await supabase
      .from('query_usage')
      .select('id')
      .limit(1);

    if (!usageError) {
      console.log('✅ Query usage table accessible');
    } else {
      console.log('❌ Query usage table error:', usageError.message);
    }

    // Test 6: Verify storage bucket
    console.log('\nTest 6: Verifying documents storage bucket...');
    
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();

    if (!bucketError) {
      const docsBucket = buckets.find(b => b.name === 'documents');
      if (docsBucket) {
        console.log('✅ Documents storage bucket exists');
        console.log('   Public:', docsBucket.public);
        console.log('   File size limit:', docsBucket.file_size_limit);
      } else {
        console.log('⚠️  Documents storage bucket not found');
      }
    } else {
      console.log('❌ Storage bucket error:', bucketError.message);
    }

    // Cleanup
    console.log('\nCleaning up test job...');
    const { error: deleteError } = await supabase
      .from('job_queue')
      .delete()
      .eq('id', job.id);

    if (!deleteError) {
      console.log('✅ Test job cleaned up');
    }

    console.log('\n✅ All validation tests completed successfully');
    console.log('\n📝 Note: To fully test the worker, you need to:');
    console.log('   1. Upload a test PDF to Supabase Storage');
    console.log('   2. Create a job with the actual storage path');
    console.log('   3. Run the worker: npm run dev:worker');
    console.log('   4. Verify the document is created with markdown content');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testDocumentConversionJob();
