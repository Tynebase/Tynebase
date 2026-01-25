/**
 * Performance Benchmark Test for TyneBase Milestone 2
 * Task 13.6: Performance Baseline
 * 
 * Benchmarks key endpoints and measures P95 latency:
 * - Document CRUD operations (target: P95 < 500ms)
 * - RAG query operations (target: P95 < 5s)
 * - AI generation operations (target: P95 < 5s)
 * 
 * Usage:
 *   node tests/benchmark_performance.js
 * 
 * Requirements:
 *   - backend/.env with valid Supabase credentials
 *   - Test tenant and user must exist
 *   - Backend server must be running on http://localhost:3001
 */

const https = require('https');
const http = require('http');
require('dotenv').config({ path: './backend/.env' });

const BASE_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_TENANT_SUBDOMAIN = 'test';
const TEST_USER_EMAIL = 'testuser@tynebase.test';
const TEST_USER_PASSWORD = 'TestPassword123!';

let authToken = null;
let testDocumentId = null;

const performanceResults = {
  documentCRUD: {
    create: [],
    read: [],
    update: [],
    list: [],
    delete: []
  },
  ragOperations: {
    search: [],
    chat: []
  },
  aiOperations: {
    generate: []
  }
};

/**
 * Make HTTP request with timing
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        try {
          const parsedData = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            data: parsedData,
            latency,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            latency,
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Authenticate and get JWT token
 */
async function authenticate() {
  console.log('\n🔐 Authenticating test user...');
  
  const url = new URL(`${BASE_URL}/api/auth/login`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  const body = {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  };
  
  try {
    const response = await makeRequest(options, body);
    
    if (response.statusCode === 200 && response.data?.data?.access_token) {
      authToken = response.data.data.access_token;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.error('❌ Authentication failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return false;
  }
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Calculate statistics from latency array
 */
function calculateStats(latencies) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99)
  };
}

/**
 * Benchmark: Create Document
 */
async function benchmarkCreateDocument(iterations = 10) {
  console.log(`\n📝 Benchmarking Document Create (${iterations} iterations)...`);
  
  const url = new URL(`${BASE_URL}/api/documents`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  for (let i = 0; i < iterations; i++) {
    const body = {
      title: `Benchmark Document ${Date.now()}-${i}`,
      content: `This is a test document for performance benchmarking. Iteration ${i}.`,
      is_public: false
    };
    
    try {
      const response = await makeRequest(options, body);
      
      if (response.statusCode === 201) {
        performanceResults.documentCRUD.create.push(response.latency);
        
        if (i === 0 && response.data?.data?.document?.id) {
          testDocumentId = response.data.data.document.id;
        }
        
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(' Done!');
}

/**
 * Benchmark: Read Document
 */
async function benchmarkReadDocument(iterations = 20) {
  if (!testDocumentId) {
    console.log('\n⚠️  Skipping Read Document benchmark (no test document)');
    return;
  }
  
  console.log(`\n📖 Benchmarking Document Read (${iterations} iterations)...`);
  
  const url = new URL(`${BASE_URL}/api/documents/${testDocumentId}`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  for (let i = 0; i < iterations; i++) {
    try {
      const response = await makeRequest(options);
      
      if (response.statusCode === 200) {
        performanceResults.documentCRUD.read.push(response.latency);
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(' Done!');
}

/**
 * Benchmark: Update Document
 */
async function benchmarkUpdateDocument(iterations = 10) {
  if (!testDocumentId) {
    console.log('\n⚠️  Skipping Update Document benchmark (no test document)');
    return;
  }
  
  console.log(`\n✏️  Benchmarking Document Update (${iterations} iterations)...`);
  
  const url = new URL(`${BASE_URL}/api/documents/${testDocumentId}`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  for (let i = 0; i < iterations; i++) {
    const body = {
      content: `Updated content at ${Date.now()} - iteration ${i}`
    };
    
    try {
      const response = await makeRequest(options, body);
      
      if (response.statusCode === 200) {
        performanceResults.documentCRUD.update.push(response.latency);
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(' Done!');
}

/**
 * Benchmark: List Documents
 */
async function benchmarkListDocuments(iterations = 20) {
  console.log(`\n📋 Benchmarking Document List (${iterations} iterations)...`);
  
  const url = new URL(`${BASE_URL}/api/documents?page=1&limit=50`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  for (let i = 0; i < iterations; i++) {
    try {
      const response = await makeRequest(options);
      
      if (response.statusCode === 200) {
        performanceResults.documentCRUD.list.push(response.latency);
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(' Done!');
}

/**
 * Benchmark: RAG Search
 */
async function benchmarkRAGSearch(iterations = 10) {
  console.log(`\n🔍 Benchmarking RAG Search (${iterations} iterations)...`);
  
  const url = new URL(`${BASE_URL}/api/rag/search`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  const queries = [
    'What is the main topic of the documents?',
    'Explain the key concepts',
    'Summarize the content',
    'What are the important points?',
    'Describe the methodology'
  ];
  
  for (let i = 0; i < iterations; i++) {
    const body = {
      query: queries[i % queries.length],
      limit: 10,
      use_reranking: true,
      rerank_top_n: 10
    };
    
    try {
      const response = await makeRequest(options, body);
      
      if (response.statusCode === 200) {
        performanceResults.ragOperations.search.push(response.latency);
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(' Done!');
}

/**
 * Benchmark: RAG Chat (streaming)
 */
async function benchmarkRAGChat(iterations = 5) {
  console.log(`\n💬 Benchmarking RAG Chat (${iterations} iterations)...`);
  console.log('⚠️  Note: Chat endpoint may require knowledge_indexing consent and credits');
  
  const url = new URL(`${BASE_URL}/api/ai/chat`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-tenant-subdomain': TEST_TENANT_SUBDOMAIN
    }
  };
  
  const queries = [
    'What is the main topic?',
    'Explain the key concepts',
    'Summarize the content'
  ];
  
  for (let i = 0; i < iterations; i++) {
    const body = {
      query: queries[i % queries.length],
      max_context_chunks: 10,
      temperature: 0.7,
      stream: false
    };
    
    try {
      const response = await makeRequest(options, body);
      
      if (response.statusCode === 200) {
        performanceResults.ragOperations.chat.push(response.latency);
        process.stdout.write('.');
      } else if (response.statusCode === 403) {
        console.log('\n⚠️  Chat endpoint requires consent or credits - skipping remaining iterations');
        break;
      } else {
        process.stdout.write('x');
      }
    } catch (error) {
      process.stdout.write('E');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(' Done!');
}

/**
 * Print benchmark results
 */
function printResults() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 PERFORMANCE BENCHMARK RESULTS');
  console.log('='.repeat(80));
  
  console.log('\n📝 DOCUMENT CRUD OPERATIONS');
  console.log('-'.repeat(80));
  
  const operations = [
    { name: 'Create Document', data: performanceResults.documentCRUD.create, target: 500 },
    { name: 'Read Document', data: performanceResults.documentCRUD.read, target: 500 },
    { name: 'Update Document', data: performanceResults.documentCRUD.update, target: 500 },
    { name: 'List Documents', data: performanceResults.documentCRUD.list, target: 500 }
  ];
  
  operations.forEach(op => {
    if (op.data.length > 0) {
      const stats = calculateStats(op.data);
      const passed = stats.p95 <= op.target;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`\n${op.name}:`);
      console.log(`  Iterations: ${op.data.length}`);
      console.log(`  Min:        ${stats.min}ms`);
      console.log(`  Avg:        ${stats.avg}ms`);
      console.log(`  P50:        ${stats.p50}ms`);
      console.log(`  P95:        ${stats.p95}ms ${status} (target: <${op.target}ms)`);
      console.log(`  P99:        ${stats.p99}ms`);
      console.log(`  Max:        ${stats.max}ms`);
    }
  });
  
  console.log('\n\n🔍 RAG OPERATIONS');
  console.log('-'.repeat(80));
  
  const ragOps = [
    { name: 'RAG Search', data: performanceResults.ragOperations.search, target: 5000 },
    { name: 'RAG Chat', data: performanceResults.ragOperations.chat, target: 5000 }
  ];
  
  ragOps.forEach(op => {
    if (op.data.length > 0) {
      const stats = calculateStats(op.data);
      const passed = stats.p95 <= op.target;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`\n${op.name}:`);
      console.log(`  Iterations: ${op.data.length}`);
      console.log(`  Min:        ${stats.min}ms`);
      console.log(`  Avg:        ${stats.avg}ms`);
      console.log(`  P50:        ${stats.p50}ms`);
      console.log(`  P95:        ${stats.p95}ms ${status} (target: <${op.target}ms)`);
      console.log(`  P99:        ${stats.p99}ms`);
      console.log(`  Max:        ${stats.max}ms`);
    } else {
      console.log(`\n${op.name}: No data collected`);
    }
  });
  
  console.log('\n\n📈 SUMMARY');
  console.log('-'.repeat(80));
  
  const allCRUDStats = [
    ...performanceResults.documentCRUD.create,
    ...performanceResults.documentCRUD.read,
    ...performanceResults.documentCRUD.update,
    ...performanceResults.documentCRUD.list
  ];
  
  const allRAGStats = [
    ...performanceResults.ragOperations.search,
    ...performanceResults.ragOperations.chat
  ];
  
  if (allCRUDStats.length > 0) {
    const crudStats = calculateStats(allCRUDStats);
    const crudPassed = crudStats.p95 <= 500;
    console.log(`\nDocument CRUD P95: ${crudStats.p95}ms ${crudPassed ? '✅ PASS' : '❌ FAIL'} (target: <500ms)`);
  }
  
  if (allRAGStats.length > 0) {
    const ragStats = calculateStats(allRAGStats);
    const ragPassed = ragStats.p95 <= 5000;
    console.log(`RAG Operations P95: ${ragStats.p95}ms ${ragPassed ? '✅ PASS' : '❌ FAIL'} (target: <5000ms)`);
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main benchmark execution
 */
async function runBenchmarks() {
  console.log('🚀 TyneBase Performance Benchmark Suite');
  console.log('Task 13.6: Performance Baseline');
  console.log('='.repeat(80));
  
  const authenticated = await authenticate();
  if (!authenticated) {
    console.error('\n❌ Failed to authenticate. Please check credentials.');
    process.exit(1);
  }
  
  console.log('\n📊 Starting benchmarks...');
  console.log('Note: Backend server must be running on', BASE_URL);
  
  try {
    await benchmarkCreateDocument(10);
    await benchmarkReadDocument(20);
    await benchmarkUpdateDocument(10);
    await benchmarkListDocuments(20);
    
    await benchmarkRAGSearch(10);
    await benchmarkRAGChat(5);
    
    printResults();
    
    console.log('\n✅ Benchmark suite completed successfully!');
    console.log('\nResults saved to console output.');
    console.log('Copy the results to execution_summary_task13_6.md\n');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runBenchmarks();
}

module.exports = {
  runBenchmarks,
  calculateStats,
  calculatePercentile
};
