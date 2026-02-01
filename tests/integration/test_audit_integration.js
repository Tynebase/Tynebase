const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testAuditIntegration() {
  console.log('🧪 Testing Content Audit Integration...\n');

  let token = null;
  let tenantSubdomain = null;
  let testDocumentId = null;
  let testReviewId = null;

  try {
    // Step 1: Login
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

    // Step 2: Create a test document
    console.log('2️⃣ Creating test document...');
    const docResponse = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        title: 'Audit Test Document',
        content: 'This is a test document for the audit integration tests.',
        visibility: 'team'
      })
    });

    if (!docResponse.ok) {
      throw new Error(`Document creation failed: ${docResponse.status}`);
    }

    const docData = await docResponse.json();
    testDocumentId = docData.data.document.id;
    console.log(`✅ Document created: ${testDocumentId}\n`);

    // Step 3: Test GET /api/audit/stats
    console.log('3️⃣ Testing GET /api/audit/stats...');
    const statsResponse = await fetch(`${API_URL}/api/audit/stats?days=30`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!statsResponse.ok) {
      throw new Error(`Audit stats failed: ${statsResponse.status}`);
    }

    const statsData = await statsResponse.json();
    console.log('✅ Audit stats response:', JSON.stringify(statsData.data.stats, null, 2));
    console.log('✅ Health distribution:', JSON.stringify(statsData.data.health_distribution, null, 2));
    console.log('');

    // Step 4: Test GET /api/audit/stale-documents
    console.log('4️⃣ Testing GET /api/audit/stale-documents...');
    const staleResponse = await fetch(`${API_URL}/api/audit/stale-documents?days=1&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!staleResponse.ok) {
      throw new Error(`Stale documents failed: ${staleResponse.status}`);
    }

    const staleData = await staleResponse.json();
    console.log(`✅ Stale documents count: ${staleData.data.documents.length}\n`);

    // Step 5: Test GET /api/audit/top-performers
    console.log('5️⃣ Testing GET /api/audit/top-performers...');
    const performersResponse = await fetch(`${API_URL}/api/audit/top-performers?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!performersResponse.ok) {
      throw new Error(`Top performers failed: ${performersResponse.status}`);
    }

    const performersData = await performersResponse.json();
    console.log(`✅ Top performers count: ${performersData.data.documents.length}\n`);

    // Step 6: Test POST /api/audit/reviews (create review)
    console.log('6️⃣ Testing POST /api/audit/reviews...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = tomorrow.toISOString().split('T')[0];

    const createReviewResponse = await fetch(`${API_URL}/api/audit/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        document_id: testDocumentId,
        reason: 'Scheduled review - Integration test',
        priority: 'high',
        due_date: dueDate
      })
    });

    if (!createReviewResponse.ok) {
      const errorText = await createReviewResponse.text();
      throw new Error(`Create review failed: ${createReviewResponse.status} - ${errorText}`);
    }

    const createReviewData = await createReviewResponse.json();
    testReviewId = createReviewData.data.review.id;
    console.log(`✅ Review created: ${testReviewId}\n`);

    // Step 7: Test GET /api/audit/reviews
    console.log('7️⃣ Testing GET /api/audit/reviews...');
    const reviewsResponse = await fetch(`${API_URL}/api/audit/reviews?status=pending&limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!reviewsResponse.ok) {
      throw new Error(`Get reviews failed: ${reviewsResponse.status}`);
    }

    const reviewsData = await reviewsResponse.json();
    console.log(`✅ Pending reviews count: ${reviewsData.data.reviews.length}\n`);

    // Step 8: Test PATCH /api/audit/reviews/:id
    console.log('8️⃣ Testing PATCH /api/audit/reviews/:id...');
    const updateReviewResponse = await fetch(`${API_URL}/api/audit/reviews/${testReviewId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      },
      body: JSON.stringify({
        status: 'in_progress',
        notes: 'Started review process'
      })
    });

    if (!updateReviewResponse.ok) {
      throw new Error(`Update review failed: ${updateReviewResponse.status}`);
    }

    const updateReviewData = await updateReviewResponse.json();
    console.log(`✅ Review updated, status: ${updateReviewData.data.review.status}\n`);

    // Step 9: Test GET /api/audit/logs
    console.log('9️⃣ Testing GET /api/audit/logs...');
    const logsResponse = await fetch(`${API_URL}/api/audit/logs?page=1&limit=10&action_type=all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!logsResponse.ok) {
      throw new Error(`Audit logs failed: ${logsResponse.status}`);
    }

    const logsData = await logsResponse.json();
    console.log(`✅ Audit logs count: ${logsData.data.logs.length}`);
    console.log(`✅ Total logs: ${logsData.data.pagination.total}`);
    console.log(`✅ Total pages: ${logsData.data.pagination.total_pages}\n`);

    // Step 10: Test GET /api/audit/logs with filtering
    console.log('🔟 Testing GET /api/audit/logs with document filter...');
    const filteredLogsResponse = await fetch(`${API_URL}/api/audit/logs?page=1&limit=5&action_type=document`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!filteredLogsResponse.ok) {
      throw new Error(`Filtered audit logs failed: ${filteredLogsResponse.status}`);
    }

    const filteredLogsData = await filteredLogsResponse.json();
    console.log(`✅ Document audit logs count: ${filteredLogsData.data.logs.length}\n`);

    // Step 11: Test GET /api/audit/logs/export
    console.log('1️⃣1️⃣ Testing GET /api/audit/logs/export...');
    const exportResponse = await fetch(`${API_URL}/api/audit/logs/export?action_type=all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!exportResponse.ok) {
      throw new Error(`Export audit logs failed: ${exportResponse.status}`);
    }

    const csvContent = await exportResponse.text();
    const csvLines = csvContent.split('\n');
    console.log(`✅ CSV exported with ${csvLines.length} lines (including header)`);
    console.log(`✅ CSV header: ${csvLines[0]}\n`);

    // Step 12: Test POST /api/documents/:id/view
    console.log('1️⃣2️⃣ Testing POST /api/documents/:id/view...');
    const viewResponse = await fetch(`${API_URL}/api/documents/${testDocumentId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!viewResponse.ok) {
      throw new Error(`Track view failed: ${viewResponse.status}`);
    }

    console.log('✅ Document view tracked\n');

    // Step 13: Cleanup - Delete review
    console.log('1️⃣3️⃣ Cleanup: Deleting test review...');
    const deleteReviewResponse = await fetch(`${API_URL}/api/audit/reviews/${testReviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!deleteReviewResponse.ok) {
      console.log('⚠️ Review deletion failed (non-critical)\n');
    } else {
      console.log('✅ Test review deleted\n');
    }

    // Step 14: Cleanup - Delete document
    console.log('1️⃣4️⃣ Cleanup: Deleting test document...');
    const deleteDocResponse = await fetch(`${API_URL}/api/documents/${testDocumentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-subdomain': tenantSubdomain
      }
    });

    if (!deleteDocResponse.ok) {
      console.log('⚠️ Document deletion failed (non-critical)\n');
    } else {
      console.log('✅ Test document deleted\n');
    }

    console.log('🎉 All audit integration tests passed!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Cleanup on failure
    if (testReviewId) {
      try {
        await fetch(`${API_URL}/api/audit/reviews/${testReviewId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-subdomain': tenantSubdomain
          }
        });
      } catch {}
    }
    
    if (testDocumentId) {
      try {
        await fetch(`${API_URL}/api/documents/${testDocumentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-tenant-subdomain': tenantSubdomain
          }
        });
      } catch {}
    }
    
    process.exit(1);
  }
}

testAuditIntegration();
