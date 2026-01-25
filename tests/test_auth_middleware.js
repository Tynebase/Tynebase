/**
 * Validation Script for Task 2.4: JWT Authentication Middleware
 * 
 * Tests three scenarios:
 * 1. Request without token -> 401
 * 2. Request with invalid token -> 401
 * 3. Request with valid token -> proceeds
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const VALID_TOKEN = process.env.TEST_JWT_TOKEN;

async function testNoToken() {
  console.log('\n=== Test 1: Request without token ===');
  try {
    const response = await fetch(`${API_URL}/api/test/auth`);
    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ PASS: Returned 401 Unauthorized');
      console.log('Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

async function testInvalidToken() {
  console.log('\n=== Test 2: Request with invalid token ===');
  try {
    const response = await fetch(`${API_URL}/api/test/auth`, {
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    });
    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ PASS: Returned 401 Unauthorized');
      console.log('Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

async function testValidToken() {
  console.log('\n=== Test 3: Request with valid token ===');
  
  if (!VALID_TOKEN) {
    console.log('⚠️  SKIP: No valid token provided (set TEST_JWT_TOKEN env var)');
    console.log('To test with valid token:');
    console.log('1. Create a test user in Supabase');
    console.log('2. Get JWT token from Supabase auth');
    console.log('3. Run: TEST_JWT_TOKEN=<token> node test_auth_middleware.js');
    return null;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/test/auth`, {
      headers: {
        'Authorization': `Bearer ${VALID_TOKEN}`
      }
    });
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('✅ PASS: Request proceeded successfully');
      console.log('Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ FAIL: Expected 200 with success=true, got ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: Request error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('JWT Authentication Middleware Validation');
  console.log('Task 2.4: Create JWT Authentication Middleware');
  console.log('=================================================');
  console.log(`API URL: ${API_URL}`);
  
  const results = {
    noToken: await testNoToken(),
    invalidToken: await testInvalidToken(),
    validToken: await testValidToken(),
  };
  
  console.log('\n=================================================');
  console.log('VALIDATION SUMMARY');
  console.log('=================================================');
  console.log(`Test 1 (No Token):      ${results.noToken ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Invalid Token): ${results.invalidToken ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Valid Token):   ${results.validToken === null ? '⚠️  SKIP' : results.validToken ? '✅ PASS' : '❌ FAIL'}`);
  
  const requiredPassed = results.noToken && results.invalidToken;
  const allPassed = requiredPassed && results.validToken === true;
  
  console.log('\n=================================================');
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else if (requiredPassed && results.validToken === null) {
    console.log('⚠️  REQUIRED TESTS PASSED (Valid token test skipped)');
    console.log('To complete validation, provide a valid JWT token');
  } else {
    console.log('❌ VALIDATION FAILED');
  }
  console.log('=================================================\n');
  
  process.exit(allPassed ? 0 : requiredPassed ? 0 : 1);
}

runTests();
