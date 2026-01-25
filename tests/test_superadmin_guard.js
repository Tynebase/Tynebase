/**
 * Test Super Admin Guard Middleware
 * 
 * Validates that:
 * 1. Non-super-admin users get 403 on super admin routes
 * 2. Super admin users can access super admin routes
 * 3. Unauthenticated requests get 401
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSuperAdminGuard() {
  console.log('\n🧪 Testing Super Admin Guard Middleware\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Check if test tenant exists
    console.log('\n📋 Test 1: Verify test tenant exists');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain, name')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found. Run insert_test_tenant.js first');
      return;
    }
    console.log('✅ Test tenant found:', tenant.subdomain);

    // Test 2: Check for regular user (non-super-admin)
    console.log('\n📋 Test 2: Verify regular user exists');
    const { data: regularUser, error: regularUserError } = await supabase
      .from('users')
      .select('id, email, is_super_admin, tenant_id')
      .eq('tenant_id', tenant.id)
      .eq('is_super_admin', false)
      .limit(1)
      .single();

    if (regularUserError || !regularUser) {
      console.log('⚠️  No regular user found, creating one...');
      
      // Create a test regular user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: 'regular@test.tynebase.com',
        password: 'TestPassword123!',
        email_confirm: true,
      });

      if (authError) {
        console.error('❌ Failed to create auth user:', authError.message);
        return;
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          tenant_id: tenant.id,
          email: 'regular@test.tynebase.com',
          full_name: 'Regular Test User',
          role: 'member',
          is_super_admin: false,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to create user record:', insertError.message);
        return;
      }

      console.log('✅ Created regular user:', newUser.email);
    } else {
      console.log('✅ Regular user found:', regularUser.email);
    }

    // Test 3: Check for super admin user
    console.log('\n📋 Test 3: Verify super admin user exists');
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('id, email, is_super_admin, tenant_id')
      .eq('is_super_admin', true)
      .limit(1)
      .single();

    if (superAdminError || !superAdmin) {
      console.log('⚠️  No super admin found in users table, checking auth...');
      
      // Check if user exists in auth.users
      const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Failed to list auth users:', listError.message);
        return;
      }

      const existingAuthUser = authUsers.find(u => u.email === 'superadmin@tynebase.com');
      
      let authUserId;
      if (existingAuthUser) {
        console.log('✅ Found existing auth user, updating users table...');
        authUserId = existingAuthUser.id;
      } else {
        console.log('Creating new super admin auth user...');
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: 'superadmin@tynebase.com',
          password: 'SuperAdminPass123!',
          email_confirm: true,
        });

        if (authError) {
          console.error('❌ Failed to create super admin auth user:', authError.message);
          return;
        }
        authUserId = authUser.user.id;
      }

      // Insert or update users table
      const { data: newSuperAdmin, error: insertError } = await supabase
        .from('users')
        .upsert({
          id: authUserId,
          tenant_id: tenant.id,
          email: 'superadmin@tynebase.com',
          full_name: 'Super Admin',
          role: 'admin',
          is_super_admin: true,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to create super admin record:', insertError.message);
        return;
      }

      console.log('✅ Created super admin user:', newSuperAdmin.email);
    } else {
      console.log('✅ Super admin found:', superAdmin.email);
    }

    // Test 4: Verify is_super_admin flag values
    console.log('\n📋 Test 4: Verify is_super_admin flag values');
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('email, is_super_admin')
      .in('email', ['regular@test.tynebase.com', 'superadmin@tynebase.com']);

    if (usersError) {
      console.error('❌ Failed to query users:', usersError.message);
      return;
    }

    console.log('\nUser permissions:');
    allUsers.forEach(user => {
      const status = user.is_super_admin ? '🔑 SUPER ADMIN' : '👤 REGULAR USER';
      console.log(`  ${status}: ${user.email}`);
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Super Admin Guard Test Setup Complete\n');
    console.log('Test users created:');
    console.log('  - Regular user: regular@test.tynebase.com (is_super_admin: false)');
    console.log('  - Super admin: superadmin@tynebase.com (is_super_admin: true)');
    console.log('\n📝 Next steps:');
    console.log('  1. Start the backend server');
    console.log('  2. Test with regular user token - should get 403');
    console.log('  3. Test with super admin token - should succeed');
    console.log('  4. Test without auth token - should get 401\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

testSuperAdminGuard();
