/**
 * Debug test for signup endpoint
 */

const API_URL = 'http://localhost:8080';

async function testSignupDebug() {
  console.log('🧪 Testing POST /api/auth/signup (Debug Mode)\n');

  const testData = {
    email: `debug-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    tenant_name: 'Debug Test Corp',
    subdomain: `debug-${Date.now()}`,
    full_name: 'Debug User',
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  try {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();

    console.log(`📥 Status: ${response.status}`);
    console.log('📥 Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSignupDebug();
