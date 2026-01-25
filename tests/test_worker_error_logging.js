/**
 * Test script to validate worker error logging with sanitized details
 * Tests that error logs redact sensitive information
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

async function testErrorLogging() {
  console.log('🧪 Testing Worker Error Logging with Sanitization\n');

  try {
    // Create a job that will fail (invalid type to trigger error path)
    console.log('1️⃣ Creating job with unknown type to trigger error logging...');
    const { data: job, error: insertError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: '1521f0ae-4db7-4110-a993-c494535d9b00',
        type: 'unknown_job_type_with_password_and_secret_token',
        status: 'pending',
        payload: { 
          test: true, 
          message: 'This should trigger error logging',
          api_key: 'secret-key-12345',
          password: 'super-secret-password'
        }
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

    console.log('\n📋 Expected error log output:');
    console.log('   - Job start log (normal)');
    console.log('   - Job failed log with:');
    console.log('     • job_id, job_type, tenant_id');
    console.log('     • error_type, error_message, error_code');
    console.log('     • Sensitive words like "password", "secret", "token", "api_key" should be [REDACTED]');
    console.log('   - Job completion log with status: "failure"');

    console.log('\n✅ Test job ready for worker processing');
    console.log('   Job ID:', job.id);
    console.log('\n💡 Worker should log the error with sanitized details');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testErrorLogging();
