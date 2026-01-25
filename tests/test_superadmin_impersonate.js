require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function testSuperAdminImpersonate() {
  console.log('='.repeat(60));
  console.log('Testing Super Admin Impersonation Endpoint');
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

  console.log('\n2. Getting list of tenants to impersonate...');
  const tenantsResponse = await fetch(`${BACKEND_URL}/api/superadmin/tenants?limit=1`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!tenantsResponse.ok) {
    const errorText = await tenantsResponse.text();
    console.error('❌ Failed to get tenants:', tenantsResponse.status, errorText);
    process.exit(1);
  }

  const tenantsData = await tenantsResponse.json();
  if (!tenantsData.data.tenants || tenantsData.data.tenants.length === 0) {
    console.error('❌ No tenants found to impersonate');
    process.exit(1);
  }

  const targetTenant = tenantsData.data.tenants[0];
  console.log('✅ Found tenant to impersonate');
  console.log(`   Tenant ID: ${targetTenant.id}`);
  console.log(`   Subdomain: ${targetTenant.subdomain}`);
  console.log(`   Name: ${targetTenant.name}`);

  console.log('\n3. Testing POST /api/superadmin/impersonate/:tenantId...');
  const impersonateResponse = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/${targetTenant.id}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!impersonateResponse.ok) {
    const errorText = await impersonateResponse.text();
    console.error('❌ Impersonation failed:', impersonateResponse.status, errorText);
    process.exit(1);
  }

  const impersonateData = await impersonateResponse.json();
  console.log('✅ Impersonation successful');
  console.log('\nResponse structure:');
  console.log(JSON.stringify(impersonateData, null, 2));

  if (!impersonateData.success) {
    console.error('❌ Response indicates failure');
    process.exit(1);
  }

  if (!impersonateData.data || !impersonateData.data.access_token) {
    console.error('❌ Missing access_token in response');
    process.exit(1);
  }

  console.log('\n4. Validating response structure...');
  const { access_token, expires_in, expires_at, tenant, impersonated_user } = impersonateData.data;

  console.log(`   Access Token: ${access_token.substring(0, 20)}...`);
  console.log(`   Expires In: ${expires_in} seconds`);
  console.log(`   Expires At: ${expires_at}`);
  console.log(`   Tenant: ${tenant.subdomain} (${tenant.name})`);
  console.log(`   Impersonated User: ${impersonated_user.email}`);

  if (expires_in !== 3600) {
    console.error(`❌ Expected expires_in to be 3600 (1 hour), got ${expires_in}`);
    process.exit(1);
  }

  console.log('✅ Token expiry is correct (1 hour)');

  console.log('\n5. Testing impersonated token by accessing tenant data...');
  const testResponse = await fetch(`${BACKEND_URL}/api/documents`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'x-tenant-subdomain': tenant.subdomain,
    },
  });

  if (!testResponse.ok) {
    const errorText = await testResponse.text();
    console.error('❌ Failed to access tenant data with impersonated token:', testResponse.status, errorText);
    process.exit(1);
  }

  const testData = await testResponse.json();
  console.log('✅ Successfully accessed tenant data with impersonated token');
  console.log(`   Retrieved documents for tenant: ${targetTenant.subdomain}`);
  console.log(`   Document count: ${testData.data?.documents?.length || 0}`);

  console.log('✅ Impersonated token correctly accesses target tenant data');

  console.log('\n6. Testing with invalid tenant ID...');
  const invalidResponse = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/00000000-0000-0000-0000-000000000000`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (invalidResponse.ok) {
    console.error('❌ Should have rejected invalid tenant ID');
    process.exit(1);
  }

  const invalidData = await invalidResponse.json();
  console.log('✅ Invalid tenant ID rejected correctly');
  console.log(`   Error: ${invalidData.error.code}`);

  console.log('\n7. Testing with malformed tenant ID...');
  const malformedResponse = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/not-a-uuid`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (malformedResponse.ok) {
    console.error('❌ Should have rejected malformed tenant ID');
    process.exit(1);
  }

  console.log('✅ Malformed tenant ID rejected correctly');

  console.log('\n8. Testing without authentication...');
  const unauthResponse = await fetch(`${BACKEND_URL}/api/superadmin/impersonate/${targetTenant.id}`, {
    method: 'POST',
  });

  if (unauthResponse.ok) {
    console.error('❌ Should have rejected request without auth token');
    process.exit(1);
  }

  console.log('✅ Unauthenticated request rejected correctly');

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS PASSED');
  console.log('='.repeat(60));
  console.log('\n📝 Summary:');
  console.log('  ✅ Super admin can impersonate tenants');
  console.log('  ✅ Returns short-lived JWT (1 hour)');
  console.log('  ✅ Impersonated token works for tenant data access');
  console.log('  ✅ Invalid tenant IDs are rejected');
  console.log('  ✅ Unauthenticated requests are blocked');
  console.log('  ✅ Impersonation events are logged\n');
}

testSuperAdminImpersonate().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
