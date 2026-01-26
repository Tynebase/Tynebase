/**
 * Integration Test: Document View/Edit Page
 * 
 * Tests the frontend document detail page integration with backend API:
 * - GET /api/documents/:id - Fetch document
 * - PATCH /api/documents/:id - Update document
 * - POST /api/documents/:id/publish - Publish document
 * - DELETE /api/documents/:id - Delete document
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function getAuthToken() {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123',
      subdomain: 'test-tenant'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to authenticate');
  }
  
  const data = await response.json();
  return data.data.access_token;
}

async function testDocumentViewEdit() {
  console.log('🧪 Testing Document View/Edit Integration...\n');
  
  let token;
  let documentId;
  
  try {
    // Step 1: Authenticate
    console.log('1️⃣  Authenticating...');
    token = await getAuthToken();
    console.log('✅ Authentication successful\n');
    
    // Step 2: Create a test document
    console.log('2️⃣  Creating test document...');
    const createResponse = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      },
      body: JSON.stringify({
        title: 'Test Document for View/Edit',
        content: '<p>Initial content for testing</p>',
        is_public: false
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create document: ${error.error?.message || 'Unknown error'}`);
    }
    
    const createData = await createResponse.json();
    documentId = createData.data.document.id;
    console.log(`✅ Document created: ${documentId}\n`);
    
    // Step 3: Fetch document (simulating page load)
    console.log('3️⃣  Fetching document (GET /api/documents/:id)...');
    const getResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      }
    });
    
    if (!getResponse.ok) {
      throw new Error('Failed to fetch document');
    }
    
    const getData = await getResponse.json();
    const document = getData.data.document;
    
    console.log('✅ Document fetched successfully');
    console.log(`   Title: ${document.title}`);
    console.log(`   Status: ${document.status}`);
    console.log(`   Public: ${document.is_public}\n`);
    
    // Step 4: Update document (simulating save)
    console.log('4️⃣  Updating document (PATCH /api/documents/:id)...');
    const updateResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      },
      body: JSON.stringify({
        title: 'Updated Test Document',
        content: '<p>Updated content from frontend</p>',
        is_public: false
      })
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update document: ${error.error?.message || 'Unknown error'}`);
    }
    
    const updateData = await updateResponse.json();
    console.log('✅ Document updated successfully');
    console.log(`   New Title: ${updateData.data.document.title}\n`);
    
    // Step 5: Publish document
    console.log('5️⃣  Publishing document (POST /api/documents/:id/publish)...');
    const publishResponse = await fetch(`${API_URL}/api/documents/${documentId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      }
    });
    
    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      throw new Error(`Failed to publish document: ${error.error?.message || 'Unknown error'}`);
    }
    
    const publishData = await publishResponse.json();
    console.log('✅ Document published successfully');
    console.log(`   Status: ${publishData.data.document.status}`);
    console.log(`   Published At: ${publishData.data.document.published_at}\n`);
    
    // Step 6: Unpublish (update to draft)
    console.log('6️⃣  Unpublishing document (PATCH with is_public: false)...');
    const unpublishResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      },
      body: JSON.stringify({
        is_public: false
      })
    });
    
    if (!unpublishResponse.ok) {
      throw new Error('Failed to unpublish document');
    }
    
    console.log('✅ Document unpublished successfully\n');
    
    // Step 7: Delete document
    console.log('7️⃣  Deleting document (DELETE /api/documents/:id)...');
    const deleteResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      }
    });
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      throw new Error(`Failed to delete document: ${error.error?.message || 'Unknown error'}`);
    }
    
    const deleteData = await deleteResponse.json();
    console.log('✅ Document deleted successfully');
    console.log(`   Message: ${deleteData.data.message}\n`);
    
    // Step 8: Verify deletion (should return 404)
    console.log('8️⃣  Verifying deletion...');
    const verifyResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': 'test-tenant'
      }
    });
    
    if (verifyResponse.status === 404) {
      console.log('✅ Document confirmed deleted (404 response)\n');
    } else {
      throw new Error('Document still exists after deletion');
    }
    
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✓ Document fetch (GET)');
    console.log('  ✓ Document update (PATCH)');
    console.log('  ✓ Document publish (POST)');
    console.log('  ✓ Document unpublish (PATCH)');
    console.log('  ✓ Document delete (DELETE)');
    console.log('  ✓ Deletion verification');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    
    // Cleanup: Try to delete the document if it was created
    if (documentId && token) {
      try {
        await fetch(`${API_URL}/api/documents/${documentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-subdomain': 'test-tenant'
          }
        });
        console.log('🧹 Cleanup: Test document deleted');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup failed (document may not exist)');
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testDocumentViewEdit();
