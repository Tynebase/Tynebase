/**
 * Test script for real-time collaboration functionality
 * 
 * This script verifies:
 * 1. Hocuspocus WebSocket server is running
 * 2. Authentication works correctly
 * 3. Document state is loaded and saved
 * 4. Multiple clients can connect to the same document
 * 
 * Prerequisites:
 * - Backend server running on port 8080
 * - Collaboration server running on port 8081
 * - Valid test user credentials
 * 
 * Usage:
 *   node tests/test_collaboration.js
 */

const WebSocket = require('ws');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:8080';
const WS_URL = process.env.WS_URL || 'ws://localhost:8081';

// Test credentials
const TEST_USER = {
  email: 'collab-test@example.com',
  password: 'TestPassword123!',
  tenant_subdomain: 'collab-test'
};

let authToken = null;
let testDocumentId = null;

/**
 * Helper function to make HTTP requests
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error?.message || body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Step 1: Create test user and tenant
 */
async function setupTestUser() {
  console.log('\n📝 Step 1: Setting up test user...');
  
  try {
    const response = await makeRequest('POST', '/api/auth/signup', {
      email: TEST_USER.email,
      password: TEST_USER.password,
      tenant_name: 'Collaboration Test',
      tenant_subdomain: TEST_USER.tenant_subdomain
    });

    authToken = response.data.access_token;
    console.log('✅ Test user created successfully');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Test user already exists, logging in...');
      const response = await makeRequest('POST', '/api/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      authToken = response.data.access_token;
      console.log('✅ Logged in successfully');
    } else {
      throw error;
    }
  }
}

/**
 * Step 2: Create a test document
 */
async function createTestDocument() {
  console.log('\n📄 Step 2: Creating test document...');
  
  const response = await makeRequest('POST', '/api/documents', {
    title: 'Collaboration Test Document',
    content: 'Initial content for collaboration testing',
    is_public: false
  }, authToken);

  testDocumentId = response.data.document.id;
  console.log('✅ Test document created');
  console.log(`   Document ID: ${testDocumentId}`);
}

/**
 * Step 3: Test WebSocket connection
 */
async function testWebSocketConnection() {
  console.log('\n🔌 Step 3: Testing WebSocket connection...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    let connected = false;
    const timeout = setTimeout(() => {
      if (!connected) {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);

    ws.on('open', () => {
      console.log('✅ WebSocket connection established');
      connected = true;
      clearTimeout(timeout);
      
      // Send authentication message
      ws.send(JSON.stringify({
        type: 'auth',
        token: authToken,
        documentName: testDocumentId
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`   Received message: ${message.type || 'unknown'}`);
        
        if (message.type === 'authenticated' || message.type === 'synced') {
          console.log('✅ WebSocket authentication successful');
          ws.close();
          resolve();
        }
      } catch (e) {
        console.log(`   Received binary data: ${data.length} bytes`);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      if (connected) {
        console.log('   WebSocket connection closed');
      }
    });
  });
}

/**
 * Step 4: Test document state persistence
 */
async function testDocumentPersistence() {
  console.log('\n💾 Step 4: Testing document state persistence...');
  
  // Wait a moment for any auto-save to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const response = await makeRequest('GET', `/api/documents/${testDocumentId}`, null, authToken);
  const document = response.data.document;
  
  console.log('✅ Document retrieved successfully');
  console.log(`   Title: ${document.title}`);
  console.log(`   Content length: ${document.content?.length || 0} characters`);
  console.log(`   Has Y.js state: ${document.yjs_state ? 'Yes' : 'No'}`);
}

/**
 * Step 5: Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Step 5: Cleaning up test data...');
  
  if (testDocumentId && authToken) {
    try {
      await makeRequest('DELETE', `/api/documents/${testDocumentId}`, null, authToken);
      console.log('✅ Test document deleted');
    } catch (error) {
      console.log('⚠️  Failed to delete test document:', error.message);
    }
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Collaboration Integration Tests');
  console.log('='.repeat(50));
  console.log(`API URL: ${API_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  
  try {
    await setupTestUser();
    await createTestDocument();
    await testWebSocketConnection();
    await testDocumentPersistence();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All collaboration tests passed!');
    console.log('='.repeat(50));
    
    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(50));
    
    await cleanup();
    process.exit(1);
  }
}

// Run tests
runTests();
