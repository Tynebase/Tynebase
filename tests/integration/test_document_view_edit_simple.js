/**
 * Integration Test: Document View/Edit Page (Simplified)
 * 
 * Creates a fresh user/tenant, then tests document operations
 */

const API_URL = process.env.API_URL || 'http://127.0.0.1:8080';

async function testDocumentViewEdit() {
  console.log('🧪 Testing Document View/Edit Integration...\n');
  
  let token;
  let documentId;
  const timestamp = Date.now();
  const testEmail = `test-${timestamp}@example.com`;
  const testSubdomain = `test-${timestamp}`;
  
  try {
    // Step 1: Create user via signup
    console.log('1️⃣  Creating test user via signup...');
    console.log(`   URL: ${API_URL}/api/auth/signup`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Subdomain: ${testSubdomain}`);
    
    const signupResponse = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPassword123!',
        full_name: 'Test User',
        subdomain: testSubdomain,
        tenant_name: `Test Tenant ${timestamp}`
      })
    }).catch(err => {
      console.error('   Fetch error details:', err);
      throw new Error(`Network error: ${err.message}`);
    });
    
    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      throw new Error(`Signup failed: ${JSON.stringify(error)}`);
    }
    
    const signupData = await signupResponse.json();
    console.log(`✅ User created: ${testEmail}`);
    console.log(`   Tenant: ${testSubdomain}\n`);
    
    // Step 1b: Login to get access token
    console.log('1️⃣b Login to get access token...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPassword123!',
        subdomain: testSubdomain
      })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }
    
    const loginData = await loginResponse.json();
    token = loginData.data?.access_token;
    
    if (!token) {
      throw new Error(`No token in login response: ${JSON.stringify(loginData)}`);
    }
    
    console.log(`✅ Login successful`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);
    
    // Step 2: Create a test document
    console.log('2️⃣  Creating test document...');
    const createResponse = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': testSubdomain
      },
      body: JSON.stringify({
        title: 'Test Document for View/Edit',
        content: '<p>Initial content for testing</p>',
        is_public: false
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create document: ${JSON.stringify(error)}`);
    }
    
    const createData = await createResponse.json();
    documentId = createData.data.document.id;
    console.log(`✅ Document created: ${documentId}\n`);
    
    // Step 3: Fetch document (simulating page load)
    console.log('3️⃣  Fetching document (GET /api/documents/:id)...');
    const getResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': testSubdomain
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
        'x-tenant-subdomain': testSubdomain
      },
      body: JSON.stringify({
        title: 'Updated Test Document',
        content: '<p>Updated content from frontend</p>',
        is_public: false
      })
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update document: ${JSON.stringify(error)}`);
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
        'x-tenant-subdomain': testSubdomain
      }
    });
    
    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      throw new Error(`Failed to publish document: ${JSON.stringify(error)}`);
    }
    
    const publishData = await publishResponse.json();
    console.log('✅ Document published successfully');
    console.log(`   Status: ${publishData.data.document.status}`);
    console.log(`   Published At: ${publishData.data.document.published_at}\n`);
    
    // Step 6: Unpublish (update to private)
    console.log('6️⃣  Unpublishing document (PATCH with is_public: false)...');
    const unpublishResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': testSubdomain
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
        'x-tenant-subdomain': testSubdomain
      }
    });
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      throw new Error(`Failed to delete document: ${JSON.stringify(error)}`);
    }
    
    const deleteData = await deleteResponse.json();
    console.log('✅ Document deleted successfully');
    console.log(`   Message: ${deleteData.data.message}\n`);
    
    // Step 8: Verify deletion (should return 404)
    console.log('8️⃣  Verifying deletion...');
    const verifyResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': testSubdomain
      }
    });
    
    if (verifyResponse.status === 404) {
      console.log('✅ Document confirmed deleted (404 response)\n');
    } else {
      throw new Error('Document still exists after deletion');
    }
    
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✓ User signup');
    console.log('  ✓ Document create');
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
            'x-tenant-subdomain': testSubdomain
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
