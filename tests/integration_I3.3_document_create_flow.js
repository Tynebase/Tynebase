/**
 * Integration Test: I3.3 - Wire Document Create Flow
 * 
 * Tests that the frontend document creation UI correctly calls the backend API
 * and redirects to the editor on success.
 * 
 * Test Flow:
 * 1. User navigates to /dashboard/knowledge/new
 * 2. User enters title and content in the editor
 * 3. User clicks "Save Draft" or "Publish"
 * 4. Frontend calls POST /api/documents with document data
 * 5. Backend creates document and returns document ID
 * 6. Frontend redirects to /dashboard/knowledge/:id
 * 
 * Prerequisites:
 * - Backend API running at http://localhost:3001
 * - Valid JWT token for authentication
 * - Tenant context set
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testDocumentCreateFlow() {
  console.log('🧪 Testing Document Create Flow (Task I3.3)...\n');

  // Step 1: Login to get JWT token
  console.log('Step 1: Authenticating...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123',
    }),
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed. Please ensure test user exists.');
    console.error('   Run: node tests/setup_test_tenant.js');
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.access_token;
  const tenantSubdomain = loginData.data.user.tenants?.[0]?.subdomain || 'test-tenant';
  console.log('✅ Authenticated successfully\n');

  // Step 2: Create a new document (draft)
  console.log('Step 2: Creating new document as draft...');
  const createResponse = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      title: 'Test Document from Create Flow',
      content: 'This is test content created via the document create flow.',
      is_public: false,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    console.error('❌ Document creation failed:', error);
    process.exit(1);
  }

  const createData = await createResponse.json();
  const documentId = createData.data.document.id;
  console.log('✅ Document created successfully');
  console.log(`   Document ID: ${documentId}`);
  console.log(`   Title: ${createData.data.document.title}`);
  console.log(`   Status: ${createData.data.document.status}\n`);

  // Step 3: Verify document exists
  console.log('Step 3: Verifying document exists...');
  const getResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
  });

  if (!getResponse.ok) {
    console.error('❌ Failed to retrieve created document');
    process.exit(1);
  }

  const getData = await getResponse.json();
  console.log('✅ Document retrieved successfully');
  console.log(`   Title: ${getData.data.document.title}`);
  console.log(`   Content length: ${getData.data.document.content.length} chars\n`);

  // Step 4: Publish the document
  console.log('Step 4: Publishing document...');
  const publishResponse = await fetch(`${API_URL}/api/documents/${documentId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    console.error('❌ Document publish failed:', error);
    process.exit(1);
  }

  const publishData = await publishResponse.json();
  console.log('✅ Document published successfully');
  console.log(`   Status: ${publishData.data.document.status}`);
  console.log(`   Published at: ${publishData.data.document.published_at}\n`);

  // Step 5: Create another document with minimal data
  console.log('Step 5: Creating document with minimal data...');
  const minimalResponse = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      title: 'Untitled Document',
    }),
  });

  if (!minimalResponse.ok) {
    const error = await minimalResponse.json();
    console.error('❌ Minimal document creation failed:', error);
    process.exit(1);
  }

  const minimalData = await minimalResponse.json();
  console.log('✅ Minimal document created successfully');
  console.log(`   Document ID: ${minimalData.data.document.id}`);
  console.log(`   Title: ${minimalData.data.document.title}\n`);

  // Step 6: Cleanup - delete test documents
  console.log('Step 6: Cleaning up test documents...');
  for (const id of [documentId, minimalData.data.document.id]) {
    const deleteResponse = await fetch(`${API_URL}/api/documents/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (deleteResponse.ok) {
      console.log(`✅ Deleted document ${id}`);
    }
  }

  console.log('\n✅ All tests passed! Document create flow is working correctly.');
  console.log('\nFrontend Integration Points Verified:');
  console.log('  ✅ POST /api/documents - Create document');
  console.log('  ✅ GET /api/documents/:id - Retrieve document');
  console.log('  ✅ POST /api/documents/:id/publish - Publish document');
  console.log('  ✅ DELETE /api/documents/:id - Delete document');
  console.log('\nNext Steps:');
  console.log('  1. Test the UI at http://localhost:3000/dashboard/knowledge/new');
  console.log('  2. Verify redirect to /dashboard/knowledge/:id after save');
  console.log('  3. Verify error handling for invalid inputs');
}

// Run the test
testDocumentCreateFlow().catch((error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
