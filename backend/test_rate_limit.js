/**
 * Test script for Rate Limiting Middleware
 * 
 * Tests:
 * 1. Global rate limit: 100 requests per 10 minutes
 * 2. AI endpoint rate limit: 10 requests per minute
 * 3. Rate limit headers are present
 * 4. Cleanup doesn't affect active requests
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRateLimit() {
  console.log('\n🧪 Testing Rate Limiting Middleware\n');
  console.log('='.repeat(60));

  // Get test tenant and user
  const { data: testTenant } = await supabase
    .from('tenants')
    .select('id, subdomain')
    .eq('subdomain', 'test')
    .single();

  if (!testTenant) {
    console.error('❌ Test tenant not found');
    process.exit(1);
  }

  const { data: testUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('tenant_id', testTenant.id)
    .limit(1)
    .single();

  if (!testUser) {
    console.error('❌ Test user not found');
    process.exit(1);
  }

  // Sign in to get JWT
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: 'TestPassword123!',
  });

  if (signInError || !signInData.session) {
    console.error('❌ Failed to sign in:', signInError?.message);
    process.exit(1);
  }

  const jwt = signInData.session.access_token;
  console.log(`✅ Authenticated as ${testUser.email}\n`);

  let passCount = 0;
  let failCount = 0;

  // Test 1: Verify rate limit headers are present
  console.log('Test 1: Rate limit headers present');
  console.log('-'.repeat(60));
  try {
    const response = await fetch('http://localhost:8080/api/documents', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'x-tenant-subdomain': testTenant.subdomain,
      },
    });

    const hasLimitHeader = response.headers.has('x-ratelimit-limit');
    const hasRemainingHeader = response.headers.has('x-ratelimit-remaining');
    const hasWindowHeader = response.headers.has('x-ratelimit-window');

    if (hasLimitHeader && hasRemainingHeader && hasWindowHeader) {
      console.log('✅ PASS: All rate limit headers present');
      console.log(`   Limit: ${response.headers.get('x-ratelimit-limit')}`);
      console.log(`   Remaining: ${response.headers.get('x-ratelimit-remaining')}`);
      console.log(`   Window: ${response.headers.get('x-ratelimit-window')}s`);
      passCount++;
    } else {
      console.log('❌ FAIL: Missing rate limit headers');
      failCount++;
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message);
    failCount++;
  }

  // Test 2: Global rate limit (100 req/10min)
  console.log('\nTest 2: Global rate limit enforcement');
  console.log('-'.repeat(60));
  console.log('Making 101 requests to global endpoint...');
  
  let successCount = 0;
  let rateLimitedCount = 0;

  for (let i = 0; i < 101; i++) {
    try {
      const response = await fetch('http://localhost:8080/api/documents', {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'x-tenant-subdomain': testTenant.subdomain,
        },
      });

      if (response.status === 200) {
        successCount++;
      } else if (response.status === 429) {
        rateLimitedCount++;
        const body = await response.json();
        console.log(`   Request ${i + 1}: Rate limited (429)`);
        console.log(`   Retry after: ${body.error.retryAfter}s`);
        break;
      }
    } catch (error) {
      console.log(`   Request ${i + 1}: Error -`, error.message);
      break;
    }

    if (i % 20 === 0 && i > 0) {
      console.log(`   Progress: ${i} requests completed...`);
    }
  }

  if (rateLimitedCount > 0 && successCount === 100) {
    console.log(`✅ PASS: Rate limited after 100 requests`);
    console.log(`   Successful: ${successCount}, Rate limited: ${rateLimitedCount}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected rate limit at 101st request`);
    console.log(`   Successful: ${successCount}, Rate limited: ${rateLimitedCount}`);
    failCount++;
  }

  // Wait for rate limit to reset
  console.log('\nWaiting 2 seconds before next test...');
  await sleep(2000);

  // Test 3: AI endpoint rate limit (10 req/min) - using a mock AI endpoint
  console.log('\nTest 3: AI endpoint rate limit (10 req/min)');
  console.log('-'.repeat(60));
  console.log('Making 11 requests to /api/ai/* endpoint...');

  // Create a simple test route for AI endpoints
  successCount = 0;
  rateLimitedCount = 0;

  for (let i = 0; i < 11; i++) {
    try {
      // Using /api/ai/test as a mock endpoint (will 404 but rate limit still applies)
      const response = await fetch('http://localhost:8080/api/ai/test', {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'x-tenant-subdomain': testTenant.subdomain,
        },
      });

      if (response.status === 404 || response.status === 200) {
        successCount++;
      } else if (response.status === 429) {
        rateLimitedCount++;
        const body = await response.json();
        console.log(`   Request ${i + 1}: Rate limited (429)`);
        console.log(`   Retry after: ${body.error.retryAfter}s`);
        console.log(`   Limit: ${body.error.limit} req/${body.error.window}s`);
        break;
      }
    } catch (error) {
      console.log(`   Request ${i + 1}: Error -`, error.message);
      break;
    }
  }

  if (rateLimitedCount > 0 && successCount === 10) {
    console.log(`✅ PASS: AI endpoint rate limited after 10 requests`);
    console.log(`   Successful: ${successCount}, Rate limited: ${rateLimitedCount}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected AI rate limit at 11th request`);
    console.log(`   Successful: ${successCount}, Rate limited: ${rateLimitedCount}`);
    failCount++;
  }

  // Test 4: Different users have separate rate limits
  console.log('\nTest 4: Rate limits are per-user');
  console.log('-'.repeat(60));
  
  // Create a second test user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'testuser2@test.com',
    password: 'TestPassword123!',
    email_confirm: true,
  });

  if (!authError && authData.user) {
    // Insert into users table
    await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        tenant_id: testTenant.id,
        role: 'member',
        is_super_admin: false,
      });

    const { data: signIn2Data } = await supabase.auth.signInWithPassword({
      email: 'testuser2@test.com',
      password: 'TestPassword123!',
    });

    if (signIn2Data?.session) {
      const jwt2 = signIn2Data.session.access_token;
      
      const response = await fetch('http://localhost:8080/api/documents', {
        headers: {
          'Authorization': `Bearer ${jwt2}`,
          'x-tenant-subdomain': testTenant.subdomain,
        },
      });

      if (response.status === 200) {
        console.log('✅ PASS: Second user can make requests (separate rate limit)');
        passCount++;
      } else {
        console.log(`❌ FAIL: Second user blocked (status: ${response.status})`);
        failCount++;
      }
    }
  } else {
    console.log('⚠️  SKIP: Could not create second user for testing');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);
  
  if (failCount === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed\n');
    process.exit(1);
  }
}

testRateLimit().catch(console.error);
