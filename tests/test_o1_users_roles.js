/**
 * Objective O1 — Users & Roles Tests
 * 
 * Tests for:
 * 1. Invite bug fix (error handling)
 * 2. Role change functionality
 * 3. Pending invites endpoints
 * 4. Delete user functionality
 * 5. Admin guard (permission denied for non-admins)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// Helper to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const token = options.token || process.env.TEST_ADMIN_TOKEN;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-subdomain': process.env.TEST_TENANT_SUBDOMAIN || 'test-tenant',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  return async () => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASSED' });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

const tests = [
  // Test 1: List users endpoint works
  test('GET /api/users returns user list for admin', async () => {
    const { status, data } = await apiRequest('/api/users');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.users), 'Expected users array');
    assert(typeof data.pagination === 'object', 'Expected pagination object');
  }),

  // Test 2: List users requires authentication
  test('GET /api/users returns 401 without auth', async () => {
    const response = await fetch(`${API_BASE}/api/users`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-subdomain': process.env.TEST_TENANT_SUBDOMAIN || 'test-tenant',
      },
    });
    assert(response.status === 401, `Expected 401, got ${response.status}`);
  }),

  // Test 3: Invite user endpoint validates email
  test('POST /api/invites validates email format', async () => {
    const { status, data } = await apiRequest('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email', role: 'member' }),
    });
    assert(status === 400, `Expected 400, got ${status}`);
    assert(data.error?.code === 'VALIDATION_ERROR', 'Expected validation error');
  }),

  // Test 4: Invite user requires admin role
  test('POST /api/invites requires admin role', async () => {
    // This test requires a non-admin token
    if (!process.env.TEST_MEMBER_TOKEN) {
      console.log('  ⚠️  Skipped: TEST_MEMBER_TOKEN not set');
      return;
    }
    const { status, data } = await apiRequest('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', role: 'member' }),
      token: process.env.TEST_MEMBER_TOKEN,
    });
    assert(status === 403, `Expected 403, got ${status}`);
    assert(data.error?.code === 'FORBIDDEN', 'Expected forbidden error');
  }),

  // Test 5: Get pending invites endpoint
  test('GET /api/invites/pending returns pending invites for admin', async () => {
    const { status, data } = await apiRequest('/api/invites/pending');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.invites), 'Expected invites array');
    assert(typeof data.count === 'number', 'Expected count number');
  }),

  // Test 6: Pending invites requires admin
  test('GET /api/invites/pending requires admin role', async () => {
    if (!process.env.TEST_MEMBER_TOKEN) {
      console.log('  ⚠️  Skipped: TEST_MEMBER_TOKEN not set');
      return;
    }
    const { status, data } = await apiRequest('/api/invites/pending', {
      token: process.env.TEST_MEMBER_TOKEN,
    });
    assert(status === 403, `Expected 403, got ${status}`);
  }),

  // Test 7: Cancel invite requires valid ID
  test('DELETE /api/invites/:id returns 404 for invalid ID', async () => {
    const { status, data } = await apiRequest('/api/invites/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
    });
    assert(status === 404, `Expected 404, got ${status}`);
    assert(data.error?.code === 'NOT_FOUND', 'Expected not found error');
  }),

  // Test 8: Resend invite requires valid ID
  test('POST /api/invites/:id/resend returns 404 for invalid ID', async () => {
    const { status, data } = await apiRequest('/api/invites/00000000-0000-0000-0000-000000000000/resend', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(status === 404, `Expected 404, got ${status}`);
    assert(data.error?.code === 'NOT_FOUND', 'Expected not found error');
  }),

  // Test 9: Update user role
  test('PATCH /api/users/:id updates user role', async () => {
    // First get a user to update
    const { status: listStatus, data: listData } = await apiRequest('/api/users');
    assert(listStatus === 200, 'Failed to list users');
    
    const testUser = listData.users.find(u => u.role !== 'admin');
    if (!testUser) {
      console.log('  ⚠️  Skipped: No non-admin user to test with');
      return;
    }
    
    const originalRole = testUser.role;
    const newRole = originalRole === 'member' ? 'editor' : 'member';
    
    const { status, data } = await apiRequest(`/api/users/${testUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    });
    
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.user?.role === newRole, `Expected role ${newRole}, got ${data.user?.role}`);
    
    // Restore original role
    await apiRequest(`/api/users/${testUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: originalRole }),
    });
  }),

  // Test 10: Update user requires admin
  test('PATCH /api/users/:id requires admin role', async () => {
    if (!process.env.TEST_MEMBER_TOKEN) {
      console.log('  ⚠️  Skipped: TEST_MEMBER_TOKEN not set');
      return;
    }
    const { status, data } = await apiRequest('/api/users/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'editor' }),
      token: process.env.TEST_MEMBER_TOKEN,
    });
    assert(status === 403, `Expected 403, got ${status}`);
  }),

  // Test 11: Delete user requires admin
  test('DELETE /api/users/:id requires admin role', async () => {
    if (!process.env.TEST_MEMBER_TOKEN) {
      console.log('  ⚠️  Skipped: TEST_MEMBER_TOKEN not set');
      return;
    }
    const { status, data } = await apiRequest('/api/users/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      token: process.env.TEST_MEMBER_TOKEN,
    });
    assert(status === 403, `Expected 403, got ${status}`);
  }),

  // Test 12: Invite with valid email succeeds (or returns appropriate error)
  test('POST /api/invites with valid data returns success or user exists', async () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const { status, data } = await apiRequest('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, role: 'member' }),
    });
    // Should either succeed (200) or fail with EMAIL_EXISTS if already registered
    assert(
      status === 200 || (status === 400 && data.error?.code === 'EMAIL_EXISTS'),
      `Expected 200 or EMAIL_EXISTS, got ${status} ${data.error?.code}`
    );
  }),
];

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
  console.log('\n========================================');
  console.log('  O1 Users & Roles Tests');
  console.log('========================================\n');
  
  console.log(`API Base: ${API_BASE}`);
  console.log(`Tenant: ${process.env.TEST_TENANT_SUBDOMAIN || 'test-tenant'}`);
  console.log('');
  
  for (const testFn of tests) {
    await testFn();
  }
  
  console.log('\n========================================');
  console.log(`  Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('========================================\n');
  
  if (results.failed > 0) {
    console.log('Failed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
