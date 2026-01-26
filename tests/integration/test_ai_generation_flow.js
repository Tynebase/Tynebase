/**
 * Integration Test: AI Generation Flow (Task I4.1)
 * 
 * Tests the complete flow:
 * 1. User submits prompt via frontend
 * 2. Backend creates generation job
 * 3. Job is processed
 * 4. Document is created
 * 5. User is redirected to document
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testAIGenerationFlow() {
  console.log('🧪 Testing AI Generation Flow (Task I4.1)...\n');

  let authToken = null;
  let tenantSubdomain = null;
  let jobId = null;
  let documentId = null;

  try {
    // Step 1: Create test tenant and user
    console.log('Step 1: Creating test tenant and user...');
    const timestamp = Date.now();
    const signupResponse = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-ai-gen-${timestamp}@example.com`,
        password: 'TestPassword123!',
        tenant_name: `TestAIGen${timestamp}`,
        subdomain: `test-ai-gen-${timestamp}`,
      }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.text();
      throw new Error(`Signup failed: ${signupResponse.status} - ${error}`);
    }

    const signupData = await signupResponse.json();
    authToken = signupData.data.access_token;
    tenantSubdomain = signupData.data.tenant.subdomain;
    console.log(`✅ Created tenant: ${tenantSubdomain}\n`);

    // Step 2: Submit AI generation request
    console.log('Step 2: Submitting AI generation request...');
    const generateResponse = await fetch(`${API_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
      body: JSON.stringify({
        prompt: 'Write a brief introduction to API documentation best practices',
        model: 'deepseek-v3',
      }),
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      throw new Error(`Generation request failed: ${generateResponse.status} - ${error}`);
    }

    const generateData = await generateResponse.json();
    jobId = generateData.data.job.id;
    console.log(`✅ Job created: ${jobId}`);
    console.log(`   Status: ${generateData.data.job.status}\n`);

    // Step 3: Poll job status until completion
    console.log('Step 3: Polling job status...');
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    let job = null;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'x-tenant-subdomain': tenantSubdomain,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Job status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      job = statusData.data.job;

      console.log(`   Attempt ${attempts + 1}: ${job.status} (${job.progress || 0}%)`);

      if (job.status === 'completed') {
        console.log('✅ Job completed successfully\n');
        break;
      } else if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error_message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Job polling timeout');
    }

    // Step 4: Verify document was created
    console.log('Step 4: Verifying document creation...');
    if (!job.result || !job.result.document_id) {
      throw new Error('Job completed but no document_id in result');
    }

    documentId = job.result.document_id;
    console.log(`✅ Document created: ${documentId}\n`);

    // Step 5: Fetch the created document
    console.log('Step 5: Fetching created document...');
    const docResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-subdomain': tenantSubdomain,
      },
    });

    if (!docResponse.ok) {
      throw new Error(`Document fetch failed: ${docResponse.status}`);
    }

    const docData = await docResponse.json();
    const document = docData.data.document;

    console.log(`✅ Document fetched successfully`);
    console.log(`   Title: ${document.title}`);
    console.log(`   Content length: ${document.content?.length || 0} characters`);
    console.log(`   Status: ${document.status}\n`);

    // Verify document has content
    if (!document.content || document.content.length < 50) {
      throw new Error('Document content is too short or missing');
    }

    console.log('✅ All tests passed!\n');
    console.log('Summary:');
    console.log(`  - Job ID: ${jobId}`);
    console.log(`  - Document ID: ${documentId}`);
    console.log(`  - Document Title: ${document.title}`);
    console.log(`  - Content Length: ${document.content.length} characters`);

    return {
      success: true,
      jobId,
      documentId,
      document,
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testAIGenerationFlow()
    .then(() => {
      console.log('\n✅ AI Generation Flow test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ AI Generation Flow test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAIGenerationFlow };
