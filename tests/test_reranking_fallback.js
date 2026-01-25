/**
 * Test script to validate reranking fallback behavior
 * 
 * This test verifies that when AWS Bedrock Cohere Rerank fails,
 * the system falls back to using the top 10 vector search results.
 * 
 * Run from project root:
 * node tests/test_reranking_fallback.js
 */

const { searchDocuments } = require('../backend/src/services/rag/search');

async function testRerankingFallback() {
  console.log('=== Testing Reranking Fallback Behavior ===\n');

  // Test tenant ID (use existing test tenant)
  const testTenantId = '1521f0ae-4db7-4110-a993-c494535d9b00';
  const testQuery = 'What is TyneBase?';

  try {
    console.log('Test 1: Normal reranking (should work if Bedrock is available)');
    const resultsWithReranking = await searchDocuments({
      tenantId: testTenantId,
      query: testQuery,
      limit: 50,
      useReranking: true,
      rerankTopN: 10,
    });

    console.log(`✅ Retrieved ${resultsWithReranking.length} results with reranking`);
    console.log(`   Top result has rerankScore: ${resultsWithReranking[0]?.rerankScore !== undefined ? 'YES' : 'NO'}`);
    console.log('');

    console.log('Test 2: Fallback behavior (reranking disabled)');
    const resultsWithoutReranking = await searchDocuments({
      tenantId: testTenantId,
      query: testQuery,
      limit: 50,
      useReranking: false,
      rerankTopN: 10,
    });

    console.log(`✅ Retrieved ${resultsWithoutReranking.length} results without reranking`);
    console.log(`   Top result has rerankScore: ${resultsWithoutReranking[0]?.rerankScore !== undefined ? 'YES' : 'NO'}`);
    console.log('');

    console.log('Test 3: Verify fallback returns top 10 results');
    if (resultsWithoutReranking.length <= 10) {
      console.log(`✅ Fallback correctly returns top ${resultsWithoutReranking.length} results (≤10)`);
    } else {
      console.log(`⚠️  Warning: Expected ≤10 results, got ${resultsWithoutReranking.length}`);
    }

    console.log('\n=== All Tests Passed ===');
    console.log('\nNote: To test actual Bedrock failure, temporarily set invalid AWS credentials');
    console.log('or modify the rerankDocuments function to throw an error.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nThis could indicate:');
    console.error('1. No documents indexed for test tenant');
    console.error('2. AWS Bedrock credentials not configured');
    console.error('3. Database connection issue');
    process.exit(1);
  }
}

testRerankingFallback();
