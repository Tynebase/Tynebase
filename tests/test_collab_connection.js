/**
 * Test WebSocket connection to Hocuspocus collaboration server
 * Validates that the server accepts connections on port 8081
 */

const WebSocket = require('ws');

const COLLAB_SERVER_URL = 'ws://localhost:8081';
const TEST_DOCUMENT_ID = 'test-doc-' + Date.now();

console.log('=== Hocuspocus Connection Test ===\n');
console.log(`Connecting to: ${COLLAB_SERVER_URL}`);
console.log(`Document ID: ${TEST_DOCUMENT_ID}\n`);

const ws = new WebSocket(COLLAB_SERVER_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connection established');
  console.log('✅ Hocuspocus server is accepting connections on port 8081\n');
  
  console.log('Connection Details:');
  console.log(`- URL: ${ws.url}`);
  console.log(`- Ready State: ${ws.readyState} (OPEN)`);
  console.log(`- Protocol: ${ws.protocol || 'none'}`);
  
  console.log('\n✅ VALIDATION PASSED: Hocuspocus server initialized and accessible');
  
  ws.close();
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket connection error:', error.message);
  console.error('\n❌ VALIDATION FAILED: Cannot connect to Hocuspocus server');
  console.error('Make sure the server is running with: npm run dev:collab');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nConnection closed');
});

setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ Connection timeout - server not responding');
    console.error('Make sure the Hocuspocus server is running on port 8081');
    ws.close();
    process.exit(1);
  }
}, 5000);
