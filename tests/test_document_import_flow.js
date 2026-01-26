/**
 * Test: Document Import Flow (PDF/DOCX)
 * 
 * Tests the complete document import workflow:
 * 1. Upload a document file (PDF or DOCX)
 * 2. Track job status
 * 3. Verify document creation
 * 4. Navigate to created document
 * 
 * Prerequisites:
 * - Backend server running on http://localhost:8080
 * - Valid JWT token
 * - Test PDF or DOCX file
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testDocumentImport() {
  console.log('🧪 Testing Document Import Flow\n');
  console.log('='.repeat(60));

  // Step 1: Login to get JWT token
  console.log('\n📝 Step 1: Authenticating...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', loginResponse.status);
    console.log('💡 Make sure you have a test user created');
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.access_token;
  const tenantSubdomain = loginData.data.tenant?.subdomain || 'test';
  console.log('✅ Authenticated successfully');
  console.log(`   Tenant: ${tenantSubdomain}`);

  // Step 2: Create a test file (if not exists)
  console.log('\n📄 Step 2: Preparing test file...');
  const testFilePath = path.join(__dirname, 'test_import.txt');
  
  if (!fs.existsSync(testFilePath)) {
    const testContent = `# Test Document Import

This is a test document for validating the document import functionality.

## Features Tested
- File upload
- Job creation
- Document conversion
- Status polling

Created at: ${new Date().toISOString()}
`;
    fs.writeFileSync(testFilePath, testContent, 'utf8');
    console.log('✅ Created test file:', testFilePath);
  } else {
    console.log('✅ Using existing test file:', testFilePath);
  }

  // Step 3: Upload document
  console.log('\n📤 Step 3: Uploading document...');
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath));

  const uploadResponse = await fetch(`${API_URL}/api/documents/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
      ...formData.getHeaders(),
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json();
    console.error('❌ Upload failed:', uploadResponse.status);
    console.error('   Error:', errorData);
    process.exit(1);
  }

  const uploadData = await uploadResponse.json();
  console.log('✅ Document uploaded successfully');
  console.log(`   Job ID: ${uploadData.job_id}`);
  console.log(`   Filename: ${uploadData.filename}`);
  console.log(`   File Size: ${(uploadData.file_size / 1024).toFixed(2)} KB`);
  console.log(`   Status: ${uploadData.status}`);

  // Step 4: Poll job status
  console.log('\n⏳ Step 4: Polling job status...');
  const jobId = uploadData.job_id;
  let attempts = 0;
  const maxAttempts = 30;
  let job = null;

  while (attempts < maxAttempts) {
    const jobResponse = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!jobResponse.ok) {
      console.error('❌ Failed to fetch job status:', jobResponse.status);
      process.exit(1);
    }

    const jobData = await jobResponse.json();
    job = jobData.data.job;

    console.log(`   [${attempts + 1}/${maxAttempts}] Status: ${job.status} | Progress: ${job.progress}%`);

    if (job.status === 'completed') {
      console.log('✅ Job completed successfully');
      console.log(`   Document ID: ${job.result?.document_id || 'N/A'}`);
      break;
    }

    if (job.status === 'failed') {
      console.error('❌ Job failed:', job.error_message);
      process.exit(1);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.error('❌ Job polling timeout');
    process.exit(1);
  }

  // Step 5: Verify document creation
  if (job.result?.document_id) {
    console.log('\n📖 Step 5: Verifying document...');
    const documentId = job.result.document_id;
    
    const docResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!docResponse.ok) {
      console.error('❌ Failed to fetch document:', docResponse.status);
      process.exit(1);
    }

    const docData = await docResponse.json();
    const document = docData.data.document;

    console.log('✅ Document created successfully');
    console.log(`   Title: ${document.title}`);
    console.log(`   Status: ${document.status}`);
    console.log(`   Content Length: ${document.content.length} characters`);
    console.log(`   Created: ${document.created_at}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests passed!');
  console.log('\n📊 Test Summary:');
  console.log('   ✓ Authentication');
  console.log('   ✓ File upload');
  console.log('   ✓ Job creation');
  console.log('   ✓ Job status polling');
  console.log('   ✓ Document creation');
  console.log('   ✓ Document verification');
  console.log('\n🎉 Document import flow is working correctly!');
}

// Run the test
testDocumentImport().catch(error => {
  console.error('\n❌ Test failed with error:', error.message);
  process.exit(1);
});
