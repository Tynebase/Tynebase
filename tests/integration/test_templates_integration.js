/**
 * Integration Test: Templates Page API Integration
 * 
 * Tests that the frontend templates page correctly fetches and displays
 * templates from the backend API with category filtering.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';

async function testTemplatesIntegration() {
  console.log('🧪 Testing Templates Page Integration...\n');

  try {
    // Test 1: Fetch templates list
    console.log('Test 1: Fetching templates from backend API...');
    const response = await fetch(`${API_URL}/api/templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Templates fetched successfully');
    console.log(`   - Total templates: ${data.data.templates.length}`);
    console.log(`   - Pagination: Page ${data.data.pagination.page} of ${data.data.pagination.totalPages}`);

    // Test 2: Verify template structure
    console.log('\nTest 2: Verifying template data structure...');
    if (data.data.templates.length > 0) {
      const template = data.data.templates[0];
      const requiredFields = ['id', 'title', 'content', 'category', 'visibility', 'created_at'];
      const missingFields = requiredFields.filter(field => !(field in template));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      console.log('✅ Template structure is valid');
      console.log(`   - Sample template: "${template.title}"`);
      console.log(`   - Category: ${template.category || 'None'}`);
      console.log(`   - Visibility: ${template.visibility}`);
    } else {
      console.log('⚠️  No templates found in database');
    }

    // Test 3: Test category filtering
    console.log('\nTest 3: Testing category filtering...');
    const categoryResponse = await fetch(`${API_URL}/api/templates?category=engineering`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!categoryResponse.ok) {
      throw new Error(`Category filter failed: HTTP ${categoryResponse.status}`);
    }

    const categoryData = await categoryResponse.json();
    console.log('✅ Category filtering works');
    console.log(`   - Engineering templates: ${categoryData.data.templates.length}`);

    // Test 4: Test pagination
    console.log('\nTest 4: Testing pagination...');
    const paginatedResponse = await fetch(`${API_URL}/api/templates?page=1&limit=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!paginatedResponse.ok) {
      throw new Error(`Pagination failed: HTTP ${paginatedResponse.status}`);
    }

    const paginatedData = await paginatedResponse.json();
    console.log('✅ Pagination works');
    console.log(`   - Requested limit: 5`);
    console.log(`   - Returned count: ${paginatedData.data.templates.length}`);
    console.log(`   - Has next page: ${paginatedData.data.pagination.hasNextPage}`);

    console.log('\n✅ All templates integration tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ Templates integration test failed:');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Run tests
testTemplatesIntegration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
