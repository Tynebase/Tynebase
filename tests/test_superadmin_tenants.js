require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function testSuperAdminTenantsList() {
  console.log('='.repeat(60));
  console.log('Testing Super Admin Tenants List Endpoint');
  console.log('='.repeat(60));

  const superAdminEmail = 'superadmin@tynebase.com';
  const superAdminPassword = 'SuperAdminPass123!';

  console.log('\n1. Authenticating as super admin...');
  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: superAdminEmail,
      password: superAdminPassword,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    console.error('❌ Login failed:', loginResponse.status, errorText);
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.access_token;
  console.log('✅ Authenticated successfully');
  console.log(`   User: ${loginData.data.user.email}`);
  console.log(`   Super Admin: ${loginData.data.user.is_super_admin}`);

  console.log('\n2. Testing GET /api/superadmin/tenants (default pagination)...');
  const tenantsResponse = await fetch(`${BACKEND_URL}/api/superadmin/tenants`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!tenantsResponse.ok) {
    const errorText = await tenantsResponse.text();
    console.error('❌ Tenants list failed:', tenantsResponse.status, errorText);
    process.exit(1);
  }

  const tenantsData = await tenantsResponse.json();
  console.log('✅ Tenants list retrieved successfully');
  console.log('\nResponse structure:');
  console.log(JSON.stringify(tenantsData, null, 2));

  if (!tenantsData.success) {
    console.error('❌ Response indicates failure');
    process.exit(1);
  }

  if (!tenantsData.data || !tenantsData.data.tenants) {
    console.error('❌ Missing tenants data in response');
    process.exit(1);
  }

  console.log('\n3. Validating response structure...');
  const { tenants, pagination } = tenantsData.data;

  console.log(`   Total tenants: ${pagination.total}`);
  console.log(`   Page: ${pagination.page}`);
  console.log(`   Limit: ${pagination.limit}`);
  console.log(`   Total pages: ${pagination.totalPages}`);
  console.log(`   Returned: ${tenants.length} tenants`);

  if (tenants.length > 0) {
    console.log('\n4. Validating tenant data structure...');
    const firstTenant = tenants[0];
    const requiredFields = [
      'id', 'subdomain', 'name', 'tier', 
      'userCount', 'documentCount', 
      'creditsUsed', 'creditsTotal', 
      'lastActive', 'createdAt'
    ];

    const missingFields = requiredFields.filter(field => !(field in firstTenant));
    if (missingFields.length > 0) {
      console.error(`❌ Missing fields in tenant data: ${missingFields.join(', ')}`);
      process.exit(1);
    }

    console.log('✅ All required fields present');
    console.log('\nFirst tenant details:');
    console.log(`   Subdomain: ${firstTenant.subdomain}`);
    console.log(`   Name: ${firstTenant.name}`);
    console.log(`   Tier: ${firstTenant.tier}`);
    console.log(`   Users: ${firstTenant.userCount}`);
    console.log(`   Documents: ${firstTenant.documentCount}`);
    console.log(`   Credits: ${firstTenant.creditsUsed}/${firstTenant.creditsTotal}`);
    console.log(`   Last Active: ${firstTenant.lastActive || 'Never'}`);
  }

  console.log('\n5. Testing pagination (page 2, limit 10)...');
  const paginatedResponse = await fetch(`${BACKEND_URL}/api/superadmin/tenants?page=2&limit=10`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!paginatedResponse.ok) {
    const errorText = await paginatedResponse.text();
    console.error('❌ Paginated request failed:', paginatedResponse.status, errorText);
    process.exit(1);
  }

  const paginatedData = await paginatedResponse.json();
  console.log('✅ Pagination works correctly');
  console.log(`   Page 2 returned: ${paginatedData.data.tenants.length} tenants`);
  console.log(`   Pagination: page=${paginatedData.data.pagination.page}, limit=${paginatedData.data.pagination.limit}`);

  console.log('\n6. Testing invalid pagination (page 0)...');
  const invalidResponse = await fetch(`${BACKEND_URL}/api/superadmin/tenants?page=0`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (invalidResponse.ok) {
    console.error('❌ Should have rejected page=0');
    process.exit(1);
  }

  console.log('✅ Invalid pagination rejected correctly');

  console.log('\n7. Testing limit exceeding max (limit=200)...');
  const exceedLimitResponse = await fetch(`${BACKEND_URL}/api/superadmin/tenants?limit=200`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (exceedLimitResponse.ok) {
    console.error('❌ Should have rejected limit=200 (max is 100)');
    process.exit(1);
  }

  console.log('✅ Limit validation works correctly');

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS PASSED');
  console.log('='.repeat(60));
}

testSuperAdminTenantsList().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
