/**
 * Test script to validate API error handler
 * Tests that errors are logged with context but not exposed to clients
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

async function testErrorHandler() {
  console.log('🧪 Testing API Error Handler\n');

  try {
    // Test 1: Trigger a 404 error (client error)
    console.log('1️⃣ Testing 404 error (client error)...');
    try {
      await axios.get(`${API_BASE_URL}/api/nonexistent-endpoint`);
    } catch (error) {
      if (error.response) {
        console.log('✅ 404 Error Response:');
        console.log('   Status:', error.response.status);
        console.log('   Response:', JSON.stringify(error.response.data, null, 2));
        
        // Verify no stack trace in response
        if (error.response.data.error && !error.response.data.error.stack) {
          console.log('   ✅ No stack trace exposed to client');
        } else {
          console.log('   ❌ Stack trace exposed to client!');
        }
      }
    }

    console.log('\n2️⃣ Testing authentication error...');
    try {
      // Try to access protected endpoint without auth
      await axios.get(`${API_BASE_URL}/api/documents`);
    } catch (error) {
      if (error.response) {
        console.log('✅ Auth Error Response:');
        console.log('   Status:', error.response.status);
        console.log('   Response:', JSON.stringify(error.response.data, null, 2));
        
        // Verify no internal details exposed
        if (error.response.data.error && !error.response.data.error.stack) {
          console.log('   ✅ No internal details exposed to client');
        }
      }
    }

    console.log('\n📋 Expected server logs:');
    console.log('   - Error logs should include:');
    console.log('     • error_type, error_message, error_code');
    console.log('     • method, path, ip, request_id');
    console.log('     • user_id, tenant_id (if available)');
    console.log('     • timestamp');
    console.log('     • stack_trace (for 5xx errors only)');
    console.log('   - Client responses should NOT include:');
    console.log('     • stack_trace');
    console.log('     • Internal error details');
    console.log('     • File paths or code references');

    console.log('\n💡 To validate:');
    console.log('   1. Start the server: npm run dev (in backend directory)');
    console.log('   2. Run this test: node tests/test_error_handler.js');
    console.log('   3. Check server logs for error context');
    console.log('   4. Verify client responses are generic for 5xx errors');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testErrorHandler();
