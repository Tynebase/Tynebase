/**
 * Create a test user for tenant update validation
 */

require('dotenv').config({ path: './backend/.env' });

const API_BASE_URL = 'http://localhost:8080';

async function createTestUser() {
  console.log('Creating test user for tenant update validation...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tenantadmin@test.com',
        password: 'SecurePass123!',
        tenant_name: 'Tenant Update Test Corp',
        subdomain: 'tenanttest',
        full_name: 'Tenant Admin',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Signup failed:', error);
      
      // If subdomain exists, try to login instead
      if (error.error.code === 'SUBDOMAIN_EXISTS') {
        console.log('Tenant already exists, trying to login...');
        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'tenantadmin@test.com',
            password: 'SecurePass123!',
          }),
        });
        
        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          console.log('✅ Login successful');
          console.log('Tenant ID:', loginData.data.tenant.id);
          console.log('User email:', loginData.data.user.email);
          console.log('User role:', loginData.data.user.role);
          return;
        }
      }
      return;
    }

    const data = await response.json();
    console.log('✅ Test user created successfully');
    console.log('Email: tenantadmin@test.com');
    console.log('Password: SecurePass123!');
    console.log('Tenant ID:', data.data.tenant.id);
    console.log('Subdomain:', data.data.tenant.subdomain);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTestUser();
