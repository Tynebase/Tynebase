/**
 * Test: GDPR Data Export (Right to Data Portability)
 * 
 * Validates that users can export all their data in JSON format
 * as required by GDPR Article 20.
 * 
 * Test Flow:
 * 1. Create test user and tenant
 * 2. Create sample documents and templates
 * 3. Perform AI operations to generate usage history
 * 4. Request data export via GET /api/gdpr/export
 * 5. Verify export contains all user data
 * 6. Verify export format and structure
 * 7. Verify Content-Disposition header for file download
 * 
 * Expected Result:
 * - Export returns 200 OK
 * - Export contains user profile, documents, templates, usage history
 * - Export includes audit trail metadata
 * - Content-Disposition header triggers file download
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testGDPRDataExport() {
  console.log('🧪 Testing GDPR Data Export...\n');

  let accessToken;
  let userId;
  let tenantId;
  let documentId;
  let templateId;

  try {
    // Step 1: Create test user and tenant
    console.log('1️⃣  Creating test user and tenant...');
    const timestamp = Date.now();
    const signupResponse = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `gdpr-export-test-${timestamp}@example.com`,
        password: 'SecurePassword123!',
        full_name: 'GDPR Export Test User',
        subdomain: `gdpr-export-test-${timestamp}`,
        tenant_name: 'GDPR Export Test Tenant',
      }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      throw new Error(`Signup failed: ${JSON.stringify(error)}`);
    }

    const signupData = await signupResponse.json();
    userId = signupData.data.user.id;
    tenantId = signupData.data.tenant.id;
    const userEmail = signupData.data.user.email;
    const userPassword = 'SecurePassword123!';
    const tenantSubdomain = signupData.data.tenant.subdomain;
    console.log(`✅ User created: ${userId}`);
    console.log(`✅ Tenant created: ${tenantId}`);

    // Login to get access token
    console.log('🔐 Logging in to get access token...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }

    const loginData = await loginResponse.json();
    accessToken = loginData.data.access_token;
    console.log(`✅ Access token obtained\n`);

    // Step 2: Create sample document
    console.log('2️⃣  Creating sample document...');
    const docResponse = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
      body: JSON.stringify({
        title: 'GDPR Test Document',
        content: 'This is a test document for GDPR data export validation.',
      }),
    });

    if (!docResponse.ok) {
      const error = await docResponse.json();
      throw new Error(`Document creation failed: ${JSON.stringify(error)}`);
    }

    const docData = await docResponse.json();
    documentId = docData.data.document.id;
    console.log(`✅ Document created: ${documentId}\n`);

    // Step 3: Create sample template
    console.log('3️⃣  Creating sample template...');
    const templateResponse = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
      body: JSON.stringify({
        title: 'GDPR Test Template',
        description: 'Test template for GDPR export',
        content: 'Template content for testing',
        category: 'test',
        visibility: 'internal',
      }),
    });

    if (!templateResponse.ok) {
      const error = await templateResponse.json();
      throw new Error(`Template creation failed: ${JSON.stringify(error)}`);
    }

    const templateData = await templateResponse.json();
    templateId = templateData.data.template.id;
    console.log(`✅ Template created: ${templateId}\n`);

    // Step 4: Request data export
    console.log('4️⃣  Requesting GDPR data export...');
    const exportResponse = await fetch(`${API_URL}/api/gdpr/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-subdomain': signupData.user.tenant_subdomain,
      },
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.json();
      throw new Error(`Data export failed: ${JSON.stringify(error)}`);
    }

    const exportData = await exportResponse.json();
    console.log('✅ Data export received\n');

    // Step 5: Verify export structure
    console.log('5️⃣  Verifying export structure...');

    // Check export metadata
    if (!exportData.export_metadata) {
      throw new Error('Missing export_metadata');
    }
    if (exportData.export_metadata.user_id !== userId) {
      throw new Error('Export metadata user_id mismatch');
    }
    if (exportData.export_metadata.gdpr_compliance !== 'Article 20 - Right to data portability') {
      throw new Error('Missing GDPR compliance statement');
    }
    console.log('✅ Export metadata valid');

    // Check user profile
    if (!exportData.user_profile) {
      throw new Error('Missing user_profile');
    }
    if (exportData.user_profile.id !== userId) {
      throw new Error('User profile ID mismatch');
    }
    if (!exportData.user_profile.email) {
      throw new Error('Missing user email');
    }
    console.log('✅ User profile included');

    // Check tenant information
    if (!exportData.tenant_information) {
      throw new Error('Missing tenant_information');
    }
    if (exportData.tenant_information.id !== tenantId) {
      throw new Error('Tenant ID mismatch');
    }
    console.log('✅ Tenant information included');

    // Check documents
    if (!exportData.documents) {
      throw new Error('Missing documents section');
    }
    if (exportData.documents.total_count < 1) {
      throw new Error('Documents not included in export');
    }
    const exportedDoc = exportData.documents.items.find(d => d.id === documentId);
    if (!exportedDoc) {
      throw new Error('Created document not found in export');
    }
    console.log(`✅ Documents included (${exportData.documents.total_count} documents)`);

    // Check templates
    if (!exportData.templates) {
      throw new Error('Missing templates section');
    }
    if (exportData.templates.total_count < 1) {
      throw new Error('Templates not included in export');
    }
    const exportedTemplate = exportData.templates.items.find(t => t.id === templateId);
    if (!exportedTemplate) {
      throw new Error('Created template not found in export');
    }
    console.log(`✅ Templates included (${exportData.templates.total_count} templates)`);

    // Check usage history
    if (!exportData.usage_history) {
      throw new Error('Missing usage_history section');
    }
    if (typeof exportData.usage_history.total_queries !== 'number') {
      throw new Error('Invalid usage history format');
    }
    console.log(`✅ Usage history included (${exportData.usage_history.total_queries} queries)`);

    // Check audit trail
    if (!exportData.audit_trail) {
      throw new Error('Missing audit_trail');
    }
    if (!exportData.audit_trail.export_requested_at) {
      throw new Error('Missing export timestamp in audit trail');
    }
    console.log('✅ Audit trail included\n');

    // Step 6: Verify Content-Disposition header
    console.log('6️⃣  Verifying Content-Disposition header...');
    const contentDisposition = exportResponse.headers.get('Content-Disposition');
    if (!contentDisposition) {
      throw new Error('Missing Content-Disposition header');
    }
    if (!contentDisposition.includes('attachment')) {
      throw new Error('Content-Disposition should indicate attachment');
    }
    if (!contentDisposition.includes('filename=')) {
      throw new Error('Content-Disposition missing filename');
    }
    console.log(`✅ Content-Disposition: ${contentDisposition}\n`);

    // Step 7: Verify Content-Type header
    console.log('7️⃣  Verifying Content-Type header...');
    const contentType = exportResponse.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Content-Type should be application/json');
    }
    console.log(`✅ Content-Type: ${contentType}\n`);

    console.log('✅ ALL TESTS PASSED!\n');
    console.log('📊 Export Summary:');
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Documents: ${exportData.documents.total_count}`);
    console.log(`   - Templates: ${exportData.templates.total_count}`);
    console.log(`   - Queries: ${exportData.usage_history.total_queries}`);
    console.log(`   - Export Date: ${exportData.export_metadata.export_date}`);
    console.log(`   - GDPR Compliance: ${exportData.export_metadata.gdpr_compliance}`);

    return {
      success: true,
      userId,
      tenantId,
      exportData,
    };
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    throw error;
  }
}

// Run test
testGDPRDataExport()
  .then(() => {
    console.log('\n✅ GDPR Data Export test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ GDPR Data Export test failed:', error);
    process.exit(1);
  });
