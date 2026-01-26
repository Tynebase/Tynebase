/**
 * Test RAG Chat with Citation Display
 * 
 * Tests the end-to-end flow of RAG chat including:
 * - Document indexing with metadata (title)
 * - RAG chat query with streaming
 * - Citation parsing and display
 * 
 * Prerequisites:
 * - Backend server running on localhost:8080
 * - Valid test tenant and user credentials
 * - At least one published document with indexed content
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

// Test credentials (use existing test tenant)
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

let authToken = null;
let tenantSubdomain = null;
let testDocumentId = null;

/**
 * Login and get auth token
 */
async function login() {
  console.log('\n📝 Logging in...');
  
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  authToken = data.data.access_token;
  tenantSubdomain = data.data.user.tenant?.subdomain;

  console.log(`✅ Logged in as ${data.data.user.email}`);
  console.log(`   Tenant: ${tenantSubdomain}`);
}

/**
 * Create a test document
 */
async function createTestDocument() {
  console.log('\n📄 Creating test document...');

  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      title: 'RAG Citation Test Document',
      content: `# RAG Citation Test Document

## Introduction
This document is used to test the RAG citation display feature. It contains information about artificial intelligence and machine learning.

## Artificial Intelligence
Artificial intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction.

## Machine Learning
Machine learning is a subset of AI that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. It focuses on the development of computer programs that can access data and use it to learn for themselves.

## Deep Learning
Deep learning is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised.

## Natural Language Processing
Natural language processing (NLP) is a subfield of linguistics, computer science, and artificial intelligence concerned with the interactions between computers and human language.`,
      is_public: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Document creation failed: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  testDocumentId = data.data.document.id;

  console.log(`✅ Document created: ${data.data.document.title}`);
  console.log(`   ID: ${testDocumentId}`);
}

/**
 * Publish the document (triggers indexing)
 */
async function publishDocument() {
  console.log('\n📤 Publishing document...');

  const response = await fetch(`${API_URL}/api/documents/${testDocumentId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Document publish failed: ${error.error?.message || 'Unknown error'}`);
  }

  console.log('✅ Document published');
  console.log('⏳ Waiting 5 seconds for indexing to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

/**
 * Test RAG chat with streaming and citation parsing
 */
async function testRagChatWithCitations() {
  console.log('\n💬 Testing RAG chat with citations...');

  const query = 'What is machine learning?';
  console.log(`   Query: "${query}"`);

  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    body: JSON.stringify({
      query,
      stream: true,
      max_context_chunks: 5,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`RAG chat failed: ${error.error?.message || 'Unknown error'}`);
  }

  console.log('\n📡 Streaming response:');
  console.log('─'.repeat(80));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullAnswer = '';
  let citations = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'chunk' && parsed.content) {
            process.stdout.write(parsed.content);
            fullAnswer += parsed.content;
          } else if (parsed.type === 'citations' && parsed.citations) {
            citations = parsed.citations;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'Stream error');
          }
        } catch (e) {
          console.warn('\n⚠️  Failed to parse SSE data:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log('\n' + '─'.repeat(80));
  console.log('\n📚 Citations received:');
  
  if (citations.length === 0) {
    console.log('❌ No citations received!');
    throw new Error('Expected citations but received none');
  }

  citations.forEach((citation, idx) => {
    console.log(`\n[${idx + 1}] ${citation.metadata?.title || 'Untitled Document'}`);
    console.log(`    Document ID: ${citation.documentId}`);
    console.log(`    Chunk Index: ${citation.chunkIndex}`);
    console.log(`    Rerank Score: ${citation.rerankScore?.toFixed(4) || 'N/A'}`);
    console.log(`    Similarity Score: ${citation.similarityScore?.toFixed(4) || 'N/A'}`);
    console.log(`    Content Preview: ${citation.content.substring(0, 100)}...`);
  });

  // Validate citation structure
  console.log('\n✅ Citation validation:');
  const firstCitation = citations[0];
  
  if (!firstCitation.documentId) {
    throw new Error('Citation missing documentId');
  }
  console.log('   ✓ documentId present');

  if (!firstCitation.metadata?.title) {
    throw new Error('Citation missing metadata.title');
  }
  console.log('   ✓ metadata.title present');

  if (!firstCitation.content) {
    throw new Error('Citation missing content');
  }
  console.log('   ✓ content present');

  if (firstCitation.rerankScore === undefined && firstCitation.similarityScore === undefined) {
    throw new Error('Citation missing both rerankScore and similarityScore');
  }
  console.log('   ✓ relevance score present');

  console.log('\n✅ All citation fields validated successfully!');
}

/**
 * Cleanup test document
 */
async function cleanup() {
  if (!testDocumentId) return;

  console.log('\n🧹 Cleaning up test document...');

  const response = await fetch(`${API_URL}/api/documents/${testDocumentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
  });

  if (response.ok) {
    console.log('✅ Test document deleted');
  } else {
    console.log('⚠️  Failed to delete test document (may need manual cleanup)');
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 RAG Chat Citation Display Test');
  console.log('═'.repeat(80));

  try {
    await login();
    await createTestDocument();
    await publishDocument();
    await testRagChatWithCitations();
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('═'.repeat(80));
  } catch (error) {
    console.error('\n' + '═'.repeat(80));
    console.error('❌ TEST FAILED');
    console.error('═'.repeat(80));
    console.error(error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();
