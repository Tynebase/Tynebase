/**
 * Test script to validate worker job performance logging
 * Tests that logs include: job_id, job_type, tenant_id, duration_ms, result_size_bytes, status
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWorkerLogging() {
  console.log('🧪 Testing Worker Job Performance Logging\n');

  try {
    // Create a test job
    console.log('1️⃣ Creating test job...');
    const { data: job, error: insertError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: '1521f0ae-4db7-4110-a993-c494535d9b00', // test tenant
        type: 'test_job',
        status: 'pending',
        payload: { test: true, message: 'Testing worker logging' }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to create test job:', insertError);
      return;
    }

    console.log('✅ Test job created:', job.id);
    console.log('   Type:', job.type);
    console.log('   Tenant:', job.tenant_id);
    console.log('   Status:', job.status);

    console.log('\n📋 Expected log output when worker processes this job:');
    console.log('   - Job start log with: job_id, job_type, tenant_id, started_at');
    console.log('   - Job completion log with: job_id, job_type, tenant_id, status, duration_ms, result_size_bytes, started_at, completed_at');
    console.log('   - For failures: error_type, error_message, error_code (sanitized)');

    console.log('\n✅ Test job ready for worker processing');
    console.log('   Job ID:', job.id);
    console.log('\n💡 To validate:');
    console.log('   1. Start the worker: npm run worker (in backend directory)');
    console.log('   2. Watch the console output for structured logs');
    console.log('   3. Verify logs contain all required fields');
    console.log('   4. Check that sensitive data is redacted in error logs');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testWorkerLogging();
