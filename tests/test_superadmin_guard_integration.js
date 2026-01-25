/**
 * Integration Test for Super Admin Guard Middleware
 * 
 * Tests the superAdminGuard middleware with actual HTTP requests
 * 
 * Prerequisites:
 * - Backend server must be running on port 3001
 * - Test users must exist (run test_superadmin_guard.js first)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const API_BASE_URL = 'http://localhost:3001';

async function testSuperAdminGuardIntegration() {
  console.log('\n🧪 Testing Super Admin Guard Middleware - Integration Tests\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Unauthenticated request should get 401
    console.log('\n📋 Test 1: Unauthenticated request (no token)');
    const unauthResponse = await fetch(`${API_BASE_URL}/api/superadmin/test`);
    const unauthData = await unauthResponse.json();
    
    if (unauthResponse.status === 401) {
      console.log('✅ PASS: Got 401 Unauthorized');
      console.log('   Response:', JSON.stringify(unauthData, null, 2));
    } else {
      console.log(`❌ FAIL: Expected 401, got ${unauthResponse.status}`);
      console.log('   Response:', JSON.stringify(unauthData, null, 2));
    }

    // Test 2: Regular user should get 403
    console.log('\n📋 Test 2: Regular user (non-super-admin) should get 403');
    const supabaseRegular = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: regularAuth, error: regularAuthError } = await supabaseRegular.auth.signInWithPassword({
      email: 'testuser@tynebase.test',
      password: 'TestPassword123!',
    });

    if (regularAuthError) {
      console.log('❌ Failed to authenticate regular user:', regularAuthError.message);
      console.log('   Make sure the user exists with password: TestPassword123!');
    } else {
      const regularToken = regularAuth.session.access_token;
      
      const regularResponse = await fetch(`${API_BASE_URL}/api/superadmin/test`, {
        headers: {
          'Authorization': `Bearer ${regularToken}`,
        },
      });
      const regularData = await regularResponse.json();
      
      if (regularResponse.status === 403) {
        console.log('✅ PASS: Regular user got 403 Forbidden');
        console.log('   Response:', JSON.stringify(regularData, null, 2));
      } else {
        console.log(`❌ FAIL: Expected 403, got ${regularResponse.status}`);
        console.log('   Response:', JSON.stringify(regularData, null, 2));
      }
      
      await supabaseRegular.auth.signOut();
    }

    // Test 3: Super admin should succeed with 200
    console.log('\n📋 Test 3: Super admin user should get 200 OK');
    const supabaseSuperAdmin = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: superAdminAuth, error: superAdminAuthError } = await supabaseSuperAdmin.auth.signInWithPassword({
      email: 'superadmin@tynebase.com',
      password: 'SuperAdminPass123!',
    });

    if (superAdminAuthError) {
      console.log('❌ Failed to authenticate super admin:', superAdminAuthError.message);
      console.log('   Make sure the super admin exists with password: SuperAdminPass123!');
    } else {
      const superAdminToken = superAdminAuth.session.access_token;
      
      const superAdminResponse = await fetch(`${API_BASE_URL}/api/superadmin/test`, {
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
        },
      });
      const superAdminData = await superAdminResponse.json();
      
      if (superAdminResponse.status === 200) {
        console.log('✅ PASS: Super admin got 200 OK');
        console.log('   Response:', JSON.stringify(superAdminData, null, 2));
        
        if (superAdminData.user?.is_super_admin === true) {
          console.log('✅ PASS: Response confirms is_super_admin = true');
        } else {
          console.log('❌ FAIL: Response does not confirm super admin status');
        }
      } else {
        console.log(`❌ FAIL: Expected 200, got ${superAdminResponse.status}`);
        console.log('   Response:', JSON.stringify(superAdminData, null, 2));
      }
      
      await supabaseSuperAdmin.auth.signOut();
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Super Admin Guard Integration Tests Complete\n');
    console.log('Expected results:');
    console.log('  ✅ No token: 401 Unauthorized');
    console.log('  ✅ Regular user: 403 Forbidden');
    console.log('  ✅ Super admin: 200 OK with user data\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

testSuperAdminGuardIntegration();
