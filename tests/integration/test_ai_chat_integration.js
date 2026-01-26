const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testAIChatIntegration() {
  console.log('🧪 Testing AI Chat Integration...\n');

  let token = null;
  let tenantSubdomain = null;

  try {
    console.log('1️⃣ Logging in as test user...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@testcorp.com',
        password: 'SecurePass123!'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    token = loginData.data.access_token;
    tenantSubdomain = loginData.data.user.tenant?.subdomain || 'testcorp';
    console.log('✅ Login successful\n');

    console.log('2️⃣ Creating test document for RAG...');
    const docResponse = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        title: 'AI Chat Test Document',
        content: 'This is a test document about artificial intelligence and machine learning. AI systems can process natural language and provide intelligent responses. Machine learning models are trained on large datasets to recognize patterns.',
        status: 'published'
      })
    });

    if (!docResponse.ok) {
      throw new Error(`Document creation failed: ${docResponse.status}`);
    }

    const docData = await docResponse.json();
    const documentId = docData.data.document.id;
    console.log(`✅ Document created: ${documentId}\n`);

    console.log('3️⃣ Waiting for document to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Wait complete\n');

    console.log('4️⃣ Testing RAG chat query...');
    const chatResponse = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        query: 'What does the document say about artificial intelligence?',
        max_context_chunks: 5
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Chat query failed: ${chatResponse.status} - ${errorText}`);
    }

    const chatData = await chatResponse.json();
    console.log('✅ Chat response received');
    console.log(`   Answer: ${chatData.data.answer.substring(0, 100)}...`);
    console.log(`   Sources: ${chatData.data.sources.length}`);
    console.log(`   Model: ${chatData.data.model}`);
    console.log(`   Tokens: ${chatData.data.total_tokens}\n`);

    if (chatData.data.sources.length > 0) {
      console.log('📚 Source Citations:');
      chatData.data.sources.forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.title} (${Math.round(source.similarity_score * 100)}% relevance)`);
      });
      console.log('');
    }

    console.log('5️⃣ Cleaning up test document...');
    const deleteResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!deleteResponse.ok) {
      console.log('⚠️  Warning: Could not delete test document');
    } else {
      console.log('✅ Test document deleted\n');
    }

    console.log('✅ AI Chat Integration Test PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ AI Chat Integration Test FAILED');
    console.error(`   Error: ${error.message}\n`);
    return false;
  }
}

testAIChatIntegration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
