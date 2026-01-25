/**
 * Simplified Rate Limit Test
 * Tests core functionality without overwhelming the system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
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

  const { data: testUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('tenant_id', testTenant.id)
    .limit(1)
    .single();

  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: 'TestPassword123!',
  });

  const jwt = signInData.session.access_token;
  console.log(`✅ Authenticated as ${testUser.email}\n`);

  let passCount = 0;
  let failCount = 0;

  // Test 1: Rate limit headers present
  console.log('Test 1: Rate limit headers present');
  console.log('-'.repeat(60));
  const response1 = await fetch('http://localhost:8080/api/documents', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'x-tenant-subdomain': testTenant.subdomain,
    },
  });

  const hasHeaders = response1.headers.has('x-ratelimit-limit') &&
                     response1.headers.has('x-ratelimit-remaining') &&
                     response1.headers.has('x-ratelimit-window');

  if (hasHeaders) {
    console.log('✅ PASS: All rate limit headers present');
    console.log(`   Limit: ${response1.headers.get('x-ratelimit-limit')}`);
    console.log(`   Remaining: ${response1.headers.get('x-ratelimit-remaining')}`);
    console.log(`   Window: ${response1.headers.get('x-ratelimit-window')}s`);
    passCount++;
  } else {
    console.log('❌ FAIL: Missing headers');
    failCount++;
  }

  // Test 2: AI endpoint has different limit
  console.log('\nTest 2: AI endpoint has stricter limit (10 req/min vs 100 req/10min)');
  console.log('-'.repeat(60));
  const response2 = await fetch('http://localhost:8080/api/ai/test', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'x-tenant-subdomain': testTenant.subdomain,
    },
  });

  const aiLimit = response2.headers.get('x-ratelimit-limit');
  const aiWindow = response2.headers.get('x-ratelimit-window');

  if (aiLimit === '10' && aiWindow === '60') {
    console.log('✅ PASS: AI endpoint has correct limits');
    console.log(`   AI Limit: ${aiLimit} req/${aiWindow}s`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected 10 req/60s, got ${aiLimit} req/${aiWindow}s`);
    failCount++;
  }

  // Test 3: Rate limit decrements with each request
  console.log('\nTest 3: Rate limit remaining decrements');
  console.log('-'.repeat(60));
  
  const r1 = await fetch('http://localhost:8080/api/documents', {
    headers: { 'Authorization': `Bearer ${jwt}`, 'x-tenant-subdomain': testTenant.subdomain },
  });
  const remaining1 = parseInt(r1.headers.get('x-ratelimit-remaining'));

  const r2 = await fetch('http://localhost:8080/api/documents', {
    headers: { 'Authorization': `Bearer ${jwt}`, 'x-tenant-subdomain': testTenant.subdomain },
  });
  const remaining2 = parseInt(r2.headers.get('x-ratelimit-remaining'));

  if (remaining2 < remaining1) {
    console.log('✅ PASS: Remaining count decrements');
    console.log(`   First request: ${remaining1} remaining`);
    console.log(`   Second request: ${remaining2} remaining`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Remaining didn't decrement (${remaining1} -> ${remaining2})`);
    failCount++;
  }

  // Test 4: Spam requests to trigger rate limit
  console.log('\nTest 4: Rate limit enforcement (making 12 AI requests)');
  console.log('-'.repeat(60));
  
  let hitRateLimit = false;
  let requestsMade = 0;

  for (let i = 0; i < 12; i++) {
    const r = await fetch('http://localhost:8080/api/ai/test', {
      headers: { 'Authorization': `Bearer ${jwt}`, 'x-tenant-subdomain': testTenant.subdomain },
    });

    requestsMade++;

    if (r.status === 429) {
      const body = await r.json();
      console.log(`   Rate limited after ${requestsMade} requests`);
      console.log(`   Error: ${body.error.message}`);
      console.log(`   Retry after: ${body.error.retryAfter}s`);
      hitRateLimit = true;
      break;
    }
  }

  if (hitRateLimit && requestsMade <= 11) {
    console.log('✅ PASS: Rate limit enforced within expected range');
    passCount++;
  } else {
    console.log(`❌ FAIL: Rate limit not enforced (made ${requestsMade} requests)`);
    failCount++;
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
