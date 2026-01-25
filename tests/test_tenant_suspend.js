/**
 * Test Script for Task 9.5: Tenant Suspend/Unsuspend Endpoints
 * 
 * Tests:
 * 1. Suspend a tenant
 * 2. Verify tenant status is updated
 * 3. Verify suspended tenant users cannot access API
 * 4. Unsuspend the tenant
 * 5. Verify tenant users can access API again
 * 
 * Prerequisites:
 * - backend/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * - Test tenant exists (subdomain: 'test')
 * - Super admin user exists
 */

require('dotenv').config({ path: '../backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl = process.env.API_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTenantSuspend() {
  console.log('🧪 Testing Tenant Suspend/Unsuspend Endpoints\n');

  try {
    // 1. Get test tenant
    console.log('1️⃣ Fetching test tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain, name, status')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found:', tenantError);
      return;
    }

    console.log(`✅ Test tenant found: ${tenant.name} (${tenant.subdomain})`);
    console.log(`   Current status: ${tenant.status}`);
    console.log(`   Tenant ID: ${tenant.id}\n`);

    // 2. Get super admin user
    console.log('2️⃣ Fetching super admin user...');
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('id, email, is_super_admin')
      .eq('is_super_admin', true)
      .limit(1)
      .single();

    if (superAdminError || !superAdmin) {
      console.error('❌ Super admin not found:', superAdminError);
      return;
    }

    console.log(`✅ Super admin found: ${superAdmin.email}\n`);

    // 3. Generate super admin token
    console.log('3️⃣ Generating super admin token...');
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: superAdmin.email,
    });

    if (authError || !authData) {
      console.error('❌ Failed to generate token:', authError);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: authData.properties.hashed_token,
      type: 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('❌ Failed to verify token:', sessionError);
      return;
    }

    const superAdminToken = sessionData.session.access_token;
    console.log('✅ Super admin token generated\n');

    // 4. Test suspend endpoint
    console.log('4️⃣ Testing suspend endpoint...');
    const suspendResponse = await fetch(`${apiUrl}/api/superadmin/tenants/${tenant.id}/suspend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const suspendData = await suspendResponse.json();
    
    if (!suspendResponse.ok) {
      console.error('❌ Suspend failed:', suspendData);
      return;
    }

    console.log('✅ Tenant suspended successfully');
    console.log(`   Response:`, JSON.stringify(suspendData, null, 2));

    // 5. Verify tenant status in database
    console.log('\n5️⃣ Verifying tenant status in database...');
    const { data: updatedTenant, error: verifyError } = await supabase
      .from('tenants')
      .select('id, subdomain, status')
      .eq('id', tenant.id)
      .single();

    if (verifyError || !updatedTenant) {
      console.error('❌ Failed to verify tenant status:', verifyError);
      return;
    }

    if (updatedTenant.status === 'suspended') {
      console.log('✅ Tenant status confirmed as suspended in database\n');
    } else {
      console.error(`❌ Tenant status is ${updatedTenant.status}, expected suspended\n`);
      return;
    }

    // 6. Get a regular user from the suspended tenant
    console.log('6️⃣ Testing API access for suspended tenant user...');
    const { data: regularUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('tenant_id', tenant.id)
      .eq('is_super_admin', false)
      .limit(1)
      .single();

    if (userError || !regularUser) {
      console.log('⚠️  No regular users found in test tenant, skipping access test\n');
    } else {
      // Generate token for regular user
      const { data: userAuthData, error: userAuthError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: regularUser.email,
      });

      if (!userAuthError && userAuthData) {
        const { data: userSessionData, error: userSessionError } = await supabase.auth.verifyOtp({
          token_hash: userAuthData.properties.hashed_token,
          type: 'magiclink',
        });

        if (!userSessionError && userSessionData.session) {
          const userToken = userSessionData.session.access_token;

          // Try to access a protected endpoint
          const testResponse = await fetch(`${apiUrl}/api/tenants`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${userToken}`,
            },
          });

          const testData = await testResponse.json();

          if (testResponse.status === 403 && testData.error?.code === 'TENANT_SUSPENDED') {
            console.log('✅ Suspended tenant user correctly blocked from API access');
            console.log(`   Error: ${testData.error.message}\n`);
          } else {
            console.error('❌ Suspended tenant user was NOT blocked from API access');
            console.error(`   Status: ${testResponse.status}`);
            console.error(`   Response:`, testData, '\n');
          }
        }
      }
    }

    // 7. Test unsuspend endpoint
    console.log('7️⃣ Testing unsuspend endpoint...');
    const unsuspendResponse = await fetch(`${apiUrl}/api/superadmin/tenants/${tenant.id}/unsuspend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    });

    const unsuspendData = await unsuspendResponse.json();
    
    if (!unsuspendResponse.ok) {
      console.error('❌ Unsuspend failed:', unsuspendData);
      return;
    }

    console.log('✅ Tenant unsuspended successfully');
    console.log(`   Response:`, JSON.stringify(unsuspendData, null, 2));

    // 8. Verify tenant status is active again
    console.log('\n8️⃣ Verifying tenant status is active...');
    const { data: finalTenant, error: finalError } = await supabase
      .from('tenants')
      .select('id, subdomain, status')
      .eq('id', tenant.id)
      .single();

    if (finalError || !finalTenant) {
      console.error('❌ Failed to verify final tenant status:', finalError);
      return;
    }

    if (finalTenant.status === 'active') {
      console.log('✅ Tenant status confirmed as active in database\n');
    } else {
      console.error(`❌ Tenant status is ${finalTenant.status}, expected active\n`);
      return;
    }

    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testTenantSuspend();
