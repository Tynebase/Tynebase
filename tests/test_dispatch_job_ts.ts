import { dispatchJob } from '../backend/src/utils/dispatchJob';

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';

async function testDispatchJob() {
  console.log('=== Testing TypeScript dispatchJob Function ===\n');

  try {
    console.log('Test 1: Dispatching a valid job...');
    const job1 = await dispatchJob({
      tenantId: TEST_TENANT_ID,
      type: 'ai_generation',
      payload: {
        prompt: 'Generate a test document',
        model: 'gpt-4',
        temperature: 0.7
      }
    });

    console.log('✅ Job dispatched successfully!');
    console.log(`   Job ID: ${job1.id}`);
    console.log(`   Type: ${job1.type}`);
    console.log(`   Status: ${job1.status}`);
    console.log(`   Tenant ID: ${job1.tenant_id}`);
    console.log(`   Payload:`, JSON.stringify(job1.payload, null, 2));

    if (job1.status !== 'pending') {
      throw new Error(`Expected status 'pending', got '${job1.status}'`);
    }
    console.log('✅ Status is correctly set to "pending"');

    console.log('\nTest 2: Testing payload sanitization (sensitive fields)...');
    const job2 = await dispatchJob({
      tenantId: TEST_TENANT_ID,
      type: 'test_job',
      payload: {
        data: 'normal data',
        password: 'should_be_removed',
        api_key: 'secret_key',
        token: 'auth_token',
        safe_field: 'this should stay'
      }
    });

    console.log('✅ Job dispatched with sanitized payload');
    console.log('   Payload:', JSON.stringify(job2.payload, null, 2));

    if (job2.payload.password || job2.payload.api_key || job2.payload.token) {
      console.error('❌ FAIL: Sensitive fields were not removed!');
    } else {
      console.log('✅ Sensitive fields removed successfully');
    }

    if (!job2.payload.data || !job2.payload.safe_field) {
      console.error('❌ FAIL: Safe fields were removed!');
    } else {
      console.log('✅ Safe fields preserved');
    }

    console.log('\nTest 3: Testing invalid tenant ID...');
    try {
      await dispatchJob({
        tenantId: 'invalid-uuid',
        type: 'test_job',
        payload: {}
      });
      console.error('❌ FAIL: Should have thrown validation error');
    } catch (error: any) {
      if (error.message.includes('Invalid tenant ID format')) {
        console.log('✅ Validation error thrown correctly');
      } else {
        console.error('❌ FAIL: Wrong error message:', error.message);
      }
    }

    console.log('\nTest 4: Testing invalid job type...');
    try {
      await dispatchJob({
        tenantId: TEST_TENANT_ID,
        type: 'invalid_type' as any,
        payload: {}
      });
      console.error('❌ FAIL: Should have thrown validation error');
    } catch (error: any) {
      if (error.message.includes('Invalid job parameters')) {
        console.log('✅ Validation error thrown correctly');
      } else {
        console.error('❌ FAIL: Wrong error message:', error.message);
      }
    }

    console.log('\n=== ALL TESTS PASSED ===');

  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testDispatchJob();
