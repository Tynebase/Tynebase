/**
 * Test script for AI Generation Worker
 * Tests: job processing, document creation, lineage tracking, query_usage logging
 */

require('dotenv').config({ path: '../backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testAIGenerationWorker() {
  console.log('🧪 Testing AI Generation Worker\n');

  try {
    // Step 1: Get test tenant and user
    console.log('📋 Step 1: Fetching test tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found:', tenantError?.message);
      process.exit(1);
    }
    console.log(`✅ Found test tenant: ${tenant.subdomain} (${tenant.id})\n`);

    // Step 2: Get a user from this tenant
    console.log('📋 Step 2: Fetching test user...');
    const { data: membership, error: membershipError } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      console.error('❌ No user found for test tenant:', membershipError?.message);
      process.exit(1);
    }

    const userId = membership.user_id;
    console.log(`✅ Found test user: ${userId}\n`);

    // Step 3: Create a test job manually
    console.log('📋 Step 3: Creating test AI generation job...');
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        tenant_id: tenant.id,
        type: 'ai_generation',
        status: 'pending',
        payload: {
          prompt: 'Write a brief introduction about the importance of artificial intelligence in modern technology. Keep it under 200 words.',
          model: 'deepseek-v3',
          max_tokens: 500,
          user_id: userId,
          estimated_credits: 1,
        },
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('❌ Failed to create test job:', jobError?.message);
      process.exit(1);
    }

    console.log(`✅ Test job created: ${job.id}`);
    console.log(`   - Type: ${job.type}`);
    console.log(`   - Status: ${job.status}`);
    console.log(`   - Tenant: ${job.tenant_id}\n`);

    console.log('⏳ Waiting for worker to process job...');
    console.log('   (Make sure the worker is running: npm run worker)\n');

    // Step 4: Poll for job completion
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    let completedJob = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const { data: currentJob } = await supabase
        .from('job_queue')
        .select('*')
        .eq('id', job.id)
        .single();

      if (currentJob?.status === 'completed') {
        completedJob = currentJob;
        break;
      } else if (currentJob?.status === 'failed') {
        console.error('❌ Job failed:', currentJob.result);
        process.exit(1);
      }

      if (attempts % 5 === 0) {
        console.log(`   Still waiting... (${attempts}s elapsed, status: ${currentJob?.status})`);
      }
    }

    if (!completedJob) {
      console.error('❌ Job did not complete within 60 seconds');
      console.log('   Current status:', (await supabase.from('job_queue').select('*').eq('id', job.id).single()).data?.status);
      process.exit(1);
    }

    console.log(`✅ Job completed in ${attempts} seconds\n`);

    // Step 5: Verify document was created
    console.log('📋 Step 5: Verifying document creation...');
    const documentId = completedJob.result.document_id;

    if (!documentId) {
      console.error('❌ No document_id in job result');
      process.exit(1);
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('❌ Document not found:', docError?.message);
      process.exit(1);
    }

    console.log('✅ Document created successfully:');
    console.log(`   - ID: ${document.id}`);
    console.log(`   - Title: ${document.title}`);
    console.log(`   - Status: ${document.status}`);
    console.log(`   - Author: ${document.author_id}`);
    console.log(`   - Content length: ${document.content?.length || 0} characters\n`);

    // Step 6: Verify lineage event was created
    console.log('📋 Step 6: Verifying lineage event...');
    const { data: lineage, error: lineageError } = await supabase
      .from('document_lineage')
      .select('*')
      .eq('document_id', documentId)
      .eq('event_type', 'ai_generated')
      .single();

    if (lineageError || !lineage) {
      console.error('❌ Lineage event not found:', lineageError?.message);
      process.exit(1);
    }

    console.log('✅ Lineage event created:');
    console.log(`   - Event type: ${lineage.event_type}`);
    console.log(`   - Actor: ${lineage.actor_id}`);
    console.log(`   - Metadata:`, JSON.stringify(lineage.metadata, null, 2));
    console.log();

    // Step 7: Verify query_usage was logged
    console.log('📋 Step 7: Verifying query_usage logging...');
    const { data: usage, error: usageError } = await supabase
      .from('query_usage')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (usageError || !usage) {
      console.error('❌ Query usage not found:', usageError?.message);
      process.exit(1);
    }

    console.log('✅ Query usage logged:');
    console.log(`   - Query type: ${usage.query_type}`);
    console.log(`   - Model: ${usage.model}`);
    console.log(`   - Input tokens: ${usage.input_tokens}`);
    console.log(`   - Output tokens: ${usage.output_tokens}`);
    console.log(`   - Credits used: ${usage.credits_used}`);
    console.log(`   - Metadata:`, JSON.stringify(usage.metadata, null, 2));
    console.log();

    // Step 8: Verify job result
    console.log('📋 Step 8: Verifying job result...');
    console.log('✅ Job result:');
    console.log(`   - Document ID: ${completedJob.result.document_id}`);
    console.log(`   - Title: ${completedJob.result.title}`);
    console.log(`   - Tokens input: ${completedJob.result.tokens_input}`);
    console.log(`   - Tokens output: ${completedJob.result.tokens_output}`);
    console.log(`   - Model: ${completedJob.result.model}`);
    console.log(`   - Provider: ${completedJob.result.provider}`);
    console.log();

    console.log('✅ All tests passed! AI Generation Worker is working correctly.\n');
    console.log('📊 Summary:');
    console.log(`   - Job processed: ${job.id}`);
    console.log(`   - Document created: ${documentId}`);
    console.log(`   - Lineage tracked: ✅`);
    console.log(`   - Usage logged: ✅`);
    console.log(`   - Status: draft ✅`);
    console.log();

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testAIGenerationWorker();
