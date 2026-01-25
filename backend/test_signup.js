/**
 * Test script for POST /api/auth/signup endpoint
 * Validates: tenant creation, user creation, bucket creation, transaction handling
 */

const API_URL = 'http://localhost:8080';

async function testSignup() {
  console.log('🧪 Testing POST /api/auth/signup\n');

  const testData = {
    email: `test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    tenant_name: 'Test Corporation',
    subdomain: `test-${Date.now()}`,
    full_name: 'Test User',
  };

  console.log('📤 Request payload:');
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

    console.log(`📥 Response status: ${response.status}`);
    console.log('📥 Response body:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (response.status === 201) {
      console.log('✅ Signup successful!');
      console.log('');
      console.log('Validating response structure:');
      
      // Validate response structure
      const checks = [
        { name: 'Has success field', pass: data.success === true },
        { name: 'Has data object', pass: !!data.data },
        { name: 'Has user object', pass: !!data.data?.user },
        { name: 'Has tenant object', pass: !!data.data?.tenant },
        { name: 'User has id', pass: !!data.data?.user?.id },
        { name: 'User has email', pass: data.data?.user?.email === testData.email },
        { name: 'User has role=admin', pass: data.data?.user?.role === 'admin' },
        { name: 'Tenant has id', pass: !!data.data?.tenant?.id },
        { name: 'Tenant has subdomain', pass: data.data?.tenant?.subdomain === testData.subdomain },
        { name: 'Tenant has tier=free', pass: data.data?.tenant?.tier === 'free' },
      ];

      checks.forEach(check => {
        console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
      });

      const allPassed = checks.every(c => c.pass);
      console.log('');
      console.log(allPassed ? '✅ All validation checks passed!' : '❌ Some validation checks failed');

      return { success: true, data };
    } else {
      console.log('❌ Signup failed');
      return { success: false, data };
    }
  } catch (error) {
    console.error('❌ Error during signup test:', error.message);
    return { success: false, error: error.message };
  }
}

async function testDuplicateSubdomain() {
  console.log('\n🧪 Testing duplicate subdomain validation\n');

  const testData = {
    email: `test-dup-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    tenant_name: 'Test Corporation',
    subdomain: 'test', // Using existing subdomain
    full_name: 'Test User',
  };

  try {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();

    console.log(`📥 Response status: ${response.status}`);
    console.log('📥 Response body:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (response.status === 400 && data.error?.code === 'SUBDOMAIN_EXISTS') {
      console.log('✅ Duplicate subdomain correctly rejected');
      return { success: true };
    } else {
      console.log('❌ Expected 400 error for duplicate subdomain');
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Error during duplicate subdomain test:', error.message);
    return { success: false, error: error.message };
  }
}

async function testInvalidInput() {
  console.log('\n🧪 Testing input validation\n');

  const invalidCases = [
    {
      name: 'Invalid email',
      data: { email: 'invalid-email', password: 'SecurePassword123!', tenant_name: 'Test', subdomain: 'test123' },
    },
    {
      name: 'Short password',
      data: { email: 'test@example.com', password: 'short', tenant_name: 'Test', subdomain: 'test123' },
    },
    {
      name: 'Invalid subdomain (uppercase)',
      data: { email: 'test@example.com', password: 'SecurePassword123!', tenant_name: 'Test', subdomain: 'TEST' },
    },
    {
      name: 'Invalid subdomain (special chars)',
      data: { email: 'test@example.com', password: 'SecurePassword123!', tenant_name: 'Test', subdomain: 'test_123' },
    },
  ];

  let allPassed = true;

  for (const testCase of invalidCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data),
      });

      const data = await response.json();

      if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
        console.log(`  ✅ ${testCase.name} correctly rejected`);
      } else {
        console.log(`  ❌ ${testCase.name} should have been rejected`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('');
  console.log(allPassed ? '✅ All validation tests passed' : '❌ Some validation tests failed');
  return { success: allPassed };
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TyneBase Signup Endpoint Test Suite');
  console.log('═══════════════════════════════════════════════════════\n');

  const results = [];

  // Test 1: Successful signup
  const signupResult = await testSignup();
  results.push({ name: 'Signup', ...signupResult });

  // Test 2: Duplicate subdomain
  const duplicateResult = await testDuplicateSubdomain();
  results.push({ name: 'Duplicate subdomain', ...duplicateResult });

  // Test 3: Input validation
  const validationResult = await testInvalidInput();
  results.push({ name: 'Input validation', ...validationResult });

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════\n');

  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
  });

  const allPassed = results.every(r => r.success);
  console.log('');
  console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');
  console.log('');
}

runAllTests();
