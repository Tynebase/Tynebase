/**
 * Test script to verify collections API functionality
 * Run: node tests/test_collections_api.js
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testCollectionsAPI() {
  console.log('=== Collections API Test ===\n');
  console.log(`API URL: ${API_URL}\n`);

  // First, check if backend is healthy
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    const health = await healthRes.json();
    console.log('✓ Backend health check:', health.status);
  } catch (err) {
    console.error('✗ Backend not reachable:', err.message);
    console.log('\nMake sure backend is running: npm run dev (in backend folder)');
    process.exit(1);
  }

  // Try to access collections without auth (should get 401)
  try {
    const res = await fetch(`${API_URL}/api/collections`);
    const data = await res.json();
    
    if (res.status === 401) {
      console.log('✓ Collections endpoint exists (401 Unauthorized as expected without token)');
    } else if (res.status === 500) {
      console.error('✗ Collections endpoint returned 500 error');
      console.log('  Error:', JSON.stringify(data, null, 2));
      console.log('\n  This likely means the collections table does not exist in the database.');
      console.log('  Run: npx supabase db push (to apply migrations)');
      console.log('  Or apply the migration manually: supabase/migrations/20260129170000_create_collections.sql');
    } else {
      console.log(`  Collections response (${res.status}):`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('✗ Failed to reach collections endpoint:', err.message);
  }

  console.log('\n=== Test Complete ===');
}

testCollectionsAPI();
