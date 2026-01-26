/**
 * Test: Template Use Flow (Task I6.3)
 * 
 * Tests the complete flow of using a template to create a new document:
 * 1. Login as test user
 * 2. Create a test template
 * 3. Use the template to create a document
 * 4. Verify document was created with template content
 * 5. Cleanup
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testTemplateUseFlow() {
  console.log('🧪 Testing Template Use Flow (Task I6.3)...\n');

  let authToken = null;
  let tenantSubdomain = null;
  let templateId = null;
  let documentId = null;

  try {
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'TestPassword123!',
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${error.error?.message || loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    authToken = loginData.data.access_token;
    tenantSubdomain = loginData.data.user.tenants?.subdomain || 'test';
    console.log(`✅ Logged in successfully (tenant: ${tenantSubdomain})\n`);

    // Step 2: Create a test template
    console.log('📝 Step 2: Creating test template...');
    const createTemplateResponse = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
      body: JSON.stringify({
        title: 'Test Template for Use Flow',
        description: 'This is a test template for verifying the use template flow',
        content: '# Test Template\n\nThis is test content from a template.\n\n## Section 1\n\nSome content here.',
        category: 'engineering',
        visibility: 'internal',
      }),
    });

    if (!createTemplateResponse.ok) {
      const error = await createTemplateResponse.json();
      throw new Error(`Template creation failed: ${error.error?.message || createTemplateResponse.statusText}`);
    }

    const templateData = await createTemplateResponse.json();
    templateId = templateData.data.template.id;
    console.log(`✅ Template created: ${templateId}\n`);

    // Step 3: Use the template to create a document
    console.log('📝 Step 3: Using template to create document...');
    const useTemplateResponse = await fetch(`${API_URL}/api/templates/${templateId}/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!useTemplateResponse.ok) {
      const error = await useTemplateResponse.json();
      throw new Error(`Template use failed: ${error.error?.message || useTemplateResponse.statusText}`);
    }

    const useTemplateData = await useTemplateResponse.json();
    documentId = useTemplateData.data.document.id;
    console.log(`✅ Document created from template: ${documentId}\n`);

    // Step 4: Verify document was created with correct content
    console.log('📝 Step 4: Verifying document content...');
    const getDocumentResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!getDocumentResponse.ok) {
      const error = await getDocumentResponse.json();
      throw new Error(`Document fetch failed: ${error.error?.message || getDocumentResponse.statusText}`);
    }

    const documentData = await getDocumentResponse.json();
    const document = documentData.data.document;

    // Verify document properties
    const checks = [
      { name: 'Title matches template', pass: document.title === 'Test Template for Use Flow' },
      { name: 'Content matches template', pass: document.content.includes('This is test content from a template') },
      { name: 'Status is draft', pass: document.status === 'draft' },
      { name: 'Is not public', pass: document.is_public === false },
      { name: 'Has document ID', pass: !!document.id },
    ];

    console.log('Verification Results:');
    checks.forEach(check => {
      console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every(check => check.pass);
    
    if (!allPassed) {
      throw new Error('Some verification checks failed');
    }

    console.log('\n✅ All verification checks passed!\n');

    // Step 5: Cleanup - Delete test document and template
    console.log('📝 Step 5: Cleaning up...');
    
    // Delete document
    const deleteDocResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (deleteDocResponse.ok) {
      console.log(`✅ Test document deleted: ${documentId}`);
    }

    console.log('✅ Cleanup completed\n');

    console.log('🎉 Template Use Flow Test PASSED!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Test FAILED:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run the test
testTemplateUseFlow()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
