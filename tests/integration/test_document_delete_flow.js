/**
 * Integration Test: Document Delete Flow (Task I3.4)
 * 
 * Tests the complete document deletion workflow:
 * 1. Create a test document
 * 2. Verify it appears in the list
 * 3. Delete the document via API
 * 4. Verify it's removed from the list
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testDocumentDeleteFlow() {
  console.log('🧪 Testing Document Delete Flow (Task I3.4)...\n');

  // Step 1: Login to get auth token
  console.log('📝 Step 1: Logging in...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'Test123!@#',
      subdomain: 'testtenant'
    })
  });

  if (!loginResponse.ok) {
    const error = await loginResponse.json();
    throw new Error(`Login failed: ${error.error?.message || loginResponse.statusText}`);
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.token;
  console.log('✅ Login successful\n');

  // Step 2: Create a test document
  console.log('📝 Step 2: Creating test document...');
  const createResponse = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': 'testenant'
    },
    body: JSON.stringify({
      title: 'Test Document for Deletion',
      content: 'This document will be deleted as part of the test.',
      is_public: false
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(`Document creation failed: ${error.error?.message || createResponse.statusText}`);
  }

  const createData = await createResponse.json();
  const documentId = createData.data.document.id;
  console.log(`✅ Document created with ID: ${documentId}\n`);

  // Step 3: Verify document appears in list
  console.log('📝 Step 3: Verifying document appears in list...');
  const listResponse = await fetch(`${API_URL}/api/documents`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': 'testenant'
    }
  });

  if (!listResponse.ok) {
    throw new Error(`Failed to list documents: ${listResponse.statusText}`);
  }

  const listData = await listResponse.json();
  const foundInList = listData.data.documents.some(doc => doc.id === documentId);
  
  if (!foundInList) {
    throw new Error('Document not found in list after creation');
  }
  console.log('✅ Document found in list\n');

  // Step 4: Delete the document
  console.log('📝 Step 4: Deleting document...');
  const deleteResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': 'testenant'
    }
  });

  if (!deleteResponse.ok) {
    const error = await deleteResponse.json();
    throw new Error(`Document deletion failed: ${error.error?.message || deleteResponse.statusText}`);
  }

  const deleteData = await deleteResponse.json();
  console.log(`✅ Document deleted: ${deleteData.data.message}\n`);

  // Step 5: Verify document is removed from list
  console.log('📝 Step 5: Verifying document is removed from list...');
  const verifyResponse = await fetch(`${API_URL}/api/documents`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': 'testenant'
    }
  });

  if (!verifyResponse.ok) {
    throw new Error(`Failed to verify document list: ${verifyResponse.statusText}`);
  }

  const verifyData = await verifyResponse.json();
  const stillExists = verifyData.data.documents.some(doc => doc.id === documentId);
  
  if (stillExists) {
    throw new Error('Document still exists in list after deletion');
  }
  console.log('✅ Document successfully removed from list\n');

  // Step 6: Verify document cannot be retrieved
  console.log('📝 Step 6: Verifying document cannot be retrieved...');
  const getResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': 'testenant'
    }
  });

  if (getResponse.ok) {
    throw new Error('Document still accessible after deletion');
  }
  
  console.log('✅ Document properly deleted (404 response)\n');

  console.log('🎉 All tests passed! Document delete flow working correctly.\n');
  
  return {
    success: true,
    documentId,
    message: 'Document delete flow test completed successfully'
  };
}

// Run the test
testDocumentDeleteFlow()
  .then(result => {
    console.log('✅ TEST RESULT: PASS');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ TEST RESULT: FAIL');
    console.error('Error:', error.message);
    process.exit(1);
  });
