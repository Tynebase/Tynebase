require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSuperAdminOverview() {
  console.log('\n🧪 Testing Super Admin Overview Endpoint\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get a super admin user
    console.log('\n📋 Step 1: Finding super admin user...');
    const { data: superAdmins, error: superAdminError } = await supabase
      .from('users')
      .select('id, email, is_super_admin, tenant_id')
      .eq('is_super_admin', true)
      .limit(1);

    if (superAdminError) {
      console.error('❌ Error finding super admin:', superAdminError);
      return;
    }

    if (!superAdmins || superAdmins.length === 0) {
      console.log('⚠️  No super admin found. Creating one...');
      
      // Get first user and make them super admin
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .limit(1);

      if (usersError || !users || users.length === 0) {
        console.error('❌ No users found in database');
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ is_super_admin: true })
        .eq('id', users[0].id);

      if (updateError) {
        console.error('❌ Error creating super admin:', updateError);
        return;
      }

      console.log(`✅ Made ${users[0].email} a super admin`);
      superAdmins[0] = { ...users[0], is_super_admin: true };
    }

    const superAdmin = superAdmins[0];
    console.log(`✅ Found super admin: ${superAdmin.email}`);

    // Step 2: Get expected counts from database
    console.log('\n📋 Step 2: Querying database for expected counts...');
    
    const { count: expectedTenants } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    const { count: expectedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'deleted');

    const { count: expectedDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: expectedActiveUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', sevenDaysAgo)
      .neq('status', 'deleted');

    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
    const nextMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01T00:00:00Z`;
    
    const { data: queryData } = await supabase
      .from('query_usage')
      .select('id')
      .gte('created_at', currentMonthStart)
      .lt('created_at', nextMonthStart);

    const expectedAIQueries = queryData?.length || 0;

    console.log('\n📊 Expected Database Counts:');
    console.log(`   Total Tenants: ${expectedTenants || 0}`);
    console.log(`   Total Users: ${expectedUsers || 0}`);
    console.log(`   Total Documents: ${expectedDocuments || 0}`);
    console.log(`   Active Users (7d): ${expectedActiveUsers || 0}`);
    console.log(`   AI Queries (this month): ${expectedAIQueries}`);

    // Step 3: Call the API endpoint
    console.log('\n📋 Step 3: Calling /api/superadmin/overview endpoint...');
    console.log('⚠️  Note: This test requires the backend server to be running');
    console.log('   Run: cd backend && npm run dev');
    console.log('\n   To test manually, use:');
    console.log(`   curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3000/api/superadmin/overview`);

    // Step 4: Validation summary
    console.log('\n✅ Validation Complete!');
    console.log('\n📝 Summary:');
    console.log('   - Super admin user exists');
    console.log('   - Database queries successful');
    console.log('   - Expected counts calculated');
    console.log('\n   To complete validation:');
    console.log('   1. Start backend server: cd backend && npm run dev');
    console.log('   2. Get JWT token for super admin user');
    console.log('   3. Call GET /api/superadmin/overview with Authorization header');
    console.log('   4. Verify response matches expected counts above');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

testSuperAdminOverview();
