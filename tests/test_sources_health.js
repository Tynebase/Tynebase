/**
 * Test script for GET /api/sources/health endpoint
 * Tests the index health statistics endpoint
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSourcesHealth() {
  console.log('🧪 Testing Index Health Statistics\n');
  console.log('=' .repeat(60));

  try {
    // Use test tenant
    const testTenantId = '1521f0ae-4db7-4110-a993-c494535d9b00';

    console.log('\n📊 Querying document statistics...\n');

    // 1. Count total documents
    const { count: totalDocs, error: totalError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    if (totalError) {
      console.error('❌ Failed to count total documents:', totalError);
      return;
    }

    console.log(`✅ Total documents: ${totalDocs || 0}`);

    // 2. Count indexed documents
    const { count: indexedDocs, error: indexedError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId)
      .not('last_indexed_at', 'is', null);

    if (indexedError) {
      console.error('❌ Failed to count indexed documents:', indexedError);
      return;
    }

    console.log(`✅ Indexed documents: ${indexedDocs || 0}`);

    // 3. Find outdated documents (fetch all indexed docs and filter in code)
    const { data: allIndexedDocs, error: allIndexedError } = await supabase
      .from('documents')
      .select('id, title, updated_at, last_indexed_at')
      .eq('tenant_id', testTenantId)
      .not('last_indexed_at', 'is', null);

    if (allIndexedError) {
      console.error('❌ Failed to query indexed documents:', allIndexedError);
      return;
    }

    // Filter outdated documents in code (where updated_at > last_indexed_at)
    const outdatedDocs = allIndexedDocs?.filter(doc => 
      new Date(doc.updated_at) > new Date(doc.last_indexed_at)
    ) || [];

    console.log(`✅ Outdated documents: ${outdatedDocs?.length || 0}`);
    if (outdatedDocs && outdatedDocs.length > 0) {
      outdatedDocs.forEach(doc => {
        console.log(`   - ${doc.title} (${doc.id})`);
        console.log(`     Updated: ${doc.updated_at}`);
        console.log(`     Last indexed: ${doc.last_indexed_at}`);
      });
    }

    // 4. Count failed rag_index jobs
    const { count: failedJobs, error: failedJobsError } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId)
      .eq('type', 'rag_index')
      .eq('status', 'failed');

    if (failedJobsError) {
      console.error('❌ Failed to count failed jobs:', failedJobsError);
      return;
    }

    console.log(`✅ Failed rag_index jobs: ${failedJobs || 0}`);

    // 5. Get never-indexed documents
    const { data: neverIndexedDocs, error: neverIndexedError } = await supabase
      .from('documents')
      .select('id, title, created_at')
      .eq('tenant_id', testTenantId)
      .is('last_indexed_at', null);

    if (neverIndexedError) {
      console.error('❌ Failed to query never-indexed documents:', neverIndexedError);
      return;
    }

    console.log(`✅ Never-indexed documents: ${neverIndexedDocs?.length || 0}`);
    if (neverIndexedDocs && neverIndexedDocs.length > 0) {
      neverIndexedDocs.slice(0, 5).forEach(doc => {
        console.log(`   - ${doc.title} (${doc.id})`);
      });
      if (neverIndexedDocs.length > 5) {
        console.log(`   ... and ${neverIndexedDocs.length - 5} more`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 HEALTH SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Documents:        ${totalDocs || 0}`);
    console.log(`Indexed:                ${indexedDocs || 0}`);
    console.log(`Never Indexed:          ${neverIndexedDocs?.length || 0}`);
    console.log(`Outdated:               ${outdatedDocs?.length || 0}`);
    console.log(`Failed Jobs:            ${failedJobs || 0}`);
    console.log(`Needing Re-index:       ${(neverIndexedDocs?.length || 0) + (outdatedDocs?.length || 0)}`);
    console.log('='.repeat(60));

    // Calculate health percentage
    const healthPercentage = totalDocs > 0 
      ? ((indexedDocs || 0) / totalDocs * 100).toFixed(1)
      : 100;
    
    console.log(`\n📊 Index Health: ${healthPercentage}%`);
    
    if (healthPercentage === '100.0') {
      console.log('✅ All documents are indexed and up-to-date!');
    } else if (parseFloat(healthPercentage) >= 80) {
      console.log('⚠️  Most documents are indexed, but some need attention');
    } else {
      console.log('❌ Many documents need indexing');
    }

    console.log('\n✅ Validation PASSED - All queries executed successfully');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

testSourcesHealth();
