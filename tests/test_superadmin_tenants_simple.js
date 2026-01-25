require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const BACKEND_URL = 'http://localhost:8080';

async function testPagination() {
  console.log('Testing pagination with page=2, limit=10...\n');

  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@tynebase.com',
      password: 'SuperAdminPass123!',
    }),
  });

  const loginData = await loginResponse.json();
  const token = loginData.data.access_token;

  console.log('Testing page=2, limit=10...');
  const response = await fetch(`${BACKEND_URL}/api/superadmin/tenants?page=2&limit=10`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testPagination().catch(console.error);
