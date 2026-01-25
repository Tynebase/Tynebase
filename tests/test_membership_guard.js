/**
 * Test script for Tenant Membership Guard Middleware
 * 
 * Tests:
 * 1. Valid JWT + correct subdomain = 200 (proceeds)
 * 2. Valid JWT + wrong subdomain = 403 (forbidden)
 * 3. Super admin + any subdomain = 200 (bypasses check)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
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
    console.error('❌ Test tenant not found. Please ensure test tenant exists.');
    process.exit(1);
  }

  console.log(`\n✅ Test tenant found: ${testTenant.subdomain} (${testTenant.id})`);

  // Get test user (belongs to test tenant)
  const { data: testUser, error: userError } = await supabase
    .from('users')
    .select('id, email, tenant_id, is_super_admin')
    .eq('tenant_id', testTenant.id)
    .eq('is_super_admin', false)
    .limit(1)
    .single();

  if (userError || !testUser) {
    console.error('❌ Test user not found. Creating one...');
    
    // Create test user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'testuser@test.com',
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authError) {
      console.error('❌ Failed to create test user:', authError.message);
      process.exit(1);
    }

    // Insert into users table
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        tenant_id: testTenant.id,
        role: 'member',
        is_super_admin: false,
      });

    if (insertError) {
      console.error('❌ Failed to insert user:', insertError.message);
      process.exit(1);
    }

    console.log('✅ Test user created: testuser@test.com');
  } else {
    console.log(`✅ Test user found: ${testUser.email}`);
  }

  // Get or create a second tenant for testing cross-tenant access
  let { data: otherTenant, error: otherTenantError } = await supabase
    .from('tenants')
    .select('id, subdomain')
    .neq('id', testTenant.id)
    .limit(1)
    .single();

  if (otherTenantError || !otherTenant) {
    console.log('Creating second tenant for testing...');
    const { data: newTenant, error: createError } = await supabase
      .from('tenants')
      .insert({
        subdomain: 'other-test',
        name: 'Other Test Corp',
        tier: 'free',
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create second tenant:', createError.message);
      process.exit(1);
    }

    otherTenant = newTenant;
    console.log(`✅ Second tenant created: ${otherTenant.subdomain}`);
  } else {
    console.log(`✅ Second tenant found: ${otherTenant.subdomain}`);
  }

  // Sign in as test user to get JWT
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testUser?.email || 'testuser@test.com',
    password: 'TestPassword123!',
  });

  if (signInError || !signInData.session) {
    console.error('❌ Failed to sign in:', signInError?.message);
    process.exit(1);
  }

  const jwt = signInData.session.access_token;
  console.log('✅ JWT obtained for test user\n');

  // Test 1: Valid JWT + correct subdomain
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
    } else {
      console.log(`❌ FAIL: Expected 200, got ${response.status}`);
      const body = await response.text();
      console.log('Response:', body);
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
    console.log('Note: Make sure the backend server is running on port 8080');
  }

  // Test 2: Valid JWT + wrong subdomain
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
      console.log('Error message:', body.error.message);
    } else {
      console.log(`❌ FAIL: Expected 403, got ${response.status}`);
      const body = await response.text();
      console.log('Response:', body);
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
  }

  // Test 3: Super admin bypass
  console.log('\nTest 3: Super admin + any subdomain');
  console.log('-'.repeat(60));
  
  // Get or create super admin
  let { data: superAdmin, error: superAdminError } = await supabase
    .from('users')
    .select('id, email')
    .eq('is_super_admin', true)
    .limit(1)
    .single();

  if (superAdminError || !superAdmin) {
    console.log('Creating super admin user...');
    
    const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.createUser({
      email: 'superadmin@tynebase.com',
      password: 'SuperAdminPass123!',
      email_confirm: true,
    });

    if (adminAuthError) {
      console.error('❌ Failed to create super admin:', adminAuthError.message);
      process.exit(1);
    }

    const { error: adminInsertError } = await supabase
      .from('users')
      .insert({
        id: adminAuthData.user.id,
        email: adminAuthData.user.email,
        tenant_id: testTenant.id,
        role: 'admin',
        is_super_admin: true,
      });

    if (adminInsertError) {
      console.error('❌ Failed to insert super admin:', adminInsertError.message);
      process.exit(1);
    }

    superAdmin = { email: adminAuthData.user.email };
    console.log('✅ Super admin created');
  }

  const { data: adminSignInData, error: adminSignInError } = await supabase.auth.signInWithPassword({
    email: superAdmin.email,
    password: 'SuperAdminPass123!',
  });

  if (adminSignInError || !adminSignInData.session) {
    console.error('❌ Failed to sign in as super admin:', adminSignInError?.message);
    process.exit(1);
  }

  const adminJwt = adminSignInData.session.access_token;

  try {
    const response = await fetch('http://localhost:8080/api/documents', {
      headers: {
        'Authorization': `Bearer ${adminJwt}`,
        'x-tenant-subdomain': otherTenant.subdomain,
      },
    });

    if (response.status === 200) {
      console.log('✅ PASS: Super admin bypassed membership check (200)');
    } else {
      console.log(`❌ FAIL: Expected 200, got ${response.status}`);
      const body = await response.text();
      console.log('Response:', body);
    }
  } catch (error) {
    console.log('❌ FAIL: Request failed -', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Membership guard validation complete\n');
}

testMembershipGuard().catch(console.error);
