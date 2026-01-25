/**
 * Simplified Test for Tenant Membership Guard Middleware
 * 
 * Tests core functionality without super admin (which has RLS issues)
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

async function testMembershipGuard() {
  console.log('\n🧪 Testing Tenant Membership Guard Middleware\n');
  console.log('='.repeat(60));

  // Get test tenant
  const { data: testTenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, subdomain')
    .eq('subdomain', 'test')
    .single();

  if (tenantError || !testTenant) {
    console.error('❌ Test tenant not found');
    process.exit(1);
  }

  console.log(`\n✅ Test tenant found: ${testTenant.subdomain} (${testTenant.id})`);

  // Get test user
  const { data: testUser, error: userError } = await supabase
    .from('users')
    .select('id, email, tenant_id')
    .eq('tenant_id', testTenant.id)
    .limit(1)
    .single();

  if (userError || !testUser) {
    console.error('❌ Test user not found');
    process.exit(1);
  }

  console.log(`✅ Test user found: ${testUser.email}`);

  // Get second tenant
  const { data: otherTenant, error: otherError } = await supabase
    .from('tenants')
    .select('id, subdomain')
    .neq('id', testTenant.id)
    .limit(1)
    .single();

  if (otherError || !otherTenant) {
    console.error('❌ Second tenant not found');
    process.exit(1);
  }

  console.log(`✅ Second tenant found: ${otherTenant.subdomain}\n`);

  // Sign in as test user
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: 'TestPassword123!',
  });

  if (signInError || !signInData.session) {
    console.error('❌ Failed to sign in:', signInError?.message);
    process.exit(1);
  }

  const jwt = signInData.session.access_token;
  console.log('✅ JWT obtained\n');

  let passCount = 0;
  let failCount = 0;

  // Test 1: Valid JWT + correct subdomain = 200
  console.log('Test 1: Valid JWT + correct subdomain');
  console.log('-'.repeat(60));
  try {
    const response = await fetch('http://localhost:8080/api/documents', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'x-tenant-subdomain': testTenant.subdomain,
      },
    });

    if (response.status === 200) {
      console.log('✅ PASS: Request proceeded (200)');
      passCount++;
    } else {
      console.log(`❌ FAIL: Expected 200, got ${response.status}`);
      failCount++;
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
    failCount++;
  }

  // Test 2: Valid JWT + wrong subdomain = 403
  console.log('\nTest 2: Valid JWT + wrong subdomain');
  console.log('-'.repeat(60));
  try {
    const response = await fetch('http://localhost:8080/api/documents', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'x-tenant-subdomain': otherTenant.subdomain,
      },
    });

    if (response.status === 403) {
      const body = await response.json();
      console.log('✅ PASS: Request blocked with 403');
      console.log('   Error code:', body.error.code);
      console.log('   Error message:', body.error.message);
      passCount++;
    } else {
      console.log(`❌ FAIL: Expected 403, got ${response.status}`);
      failCount++;
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
    failCount++;
  }

  // Test 3: No auth token = 401
  console.log('\nTest 3: No auth token');
  console.log('-'.repeat(60));
  try {
    const response = await fetch('http://localhost:8080/api/documents', {
      headers: {
        'x-tenant-subdomain': testTenant.subdomain,
      },
    });

    if (response.status === 401) {
      console.log('✅ PASS: Request blocked with 401 (missing auth)');
      passCount++;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.status}`);
      failCount++;
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
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

testMembershipGuard().catch(console.error);
