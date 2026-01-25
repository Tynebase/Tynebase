const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testApplySuggestion() {
  console.log('=== Testing Apply Suggestion Endpoint ===\n');

  console.log('Step 1: Sign in as test user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'testpassword123',
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  console.log('✅ Authenticated as:', authData.user.email);
  const token = authData.session.access_token;

  console.log('\nStep 2: Get test document...');
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, title, content')
    .eq('tenant_id', '1521f0ae-4db7-4110-a993-c494535d9b00')
    .limit(1);

  if (docError || !documents || documents.length === 0) {
    console.error('❌ Failed to get test document:', docError?.message || 'No documents found');
    return;
  }

  const document = documents[0];
  console.log('✅ Found document:', document.title);
  console.log('   Content length:', document.content?.length || 0, 'characters');

  console.log('\nStep 3: Call apply suggestion endpoint...');
  const testSuggestion = {
    type: 'clarity',
    title: 'Add introduction section',
    reason: 'Document lacks a clear introduction explaining its purpose',
    suggested: 'Add a brief introduction paragraph explaining what this document covers',
  };

  const requestBody = {
    document_id: document.id,
    suggestion: testSuggestion,
    context: document.content?.slice(0, 500),
  };

  console.log('   Request:', JSON.stringify(requestBody, null, 2));

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/ai/enhance/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Subdomain': 'test',
    },
    body: JSON.stringify(requestBody),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('❌ API request failed:', response.status);
    console.error('   Error:', JSON.stringify(responseData, null, 2));
    return;
  }

  console.log('✅ Apply suggestion successful!');
  console.log('   Response:', JSON.stringify(responseData, null, 2));

  if (responseData.generated_content) {
    console.log('\n📝 Generated Content:');
    console.log('   Length:', responseData.generated_content.length, 'characters');
    console.log('   Preview:', responseData.generated_content.slice(0, 200) + '...');
  }

  if (responseData.credits_used) {
    console.log('\n💳 Credits used:', responseData.credits_used);
  }

  if (responseData.tokens_used) {
    console.log('🔢 Tokens used:', responseData.tokens_used);
  }

  console.log('\nStep 4: Verify query_usage was logged...');
  const { data: usageData, error: usageError } = await supabase
    .from('query_usage')
    .select('*')
    .eq('query_type', 'apply_suggestion')
    .order('created_at', { ascending: false })
    .limit(1);

  if (usageError) {
    console.error('❌ Failed to query usage log:', usageError.message);
    return;
  }

  if (!usageData || usageData.length === 0) {
    console.error('❌ No usage log found for apply_suggestion');
    return;
  }

  console.log('✅ Usage logged successfully');
  console.log('   Query type:', usageData[0].query_type);
  console.log('   AI model:', usageData[0].ai_model);
  console.log('   Credits charged:', usageData[0].credits_charged);
  console.log('   Metadata:', JSON.stringify(usageData[0].metadata, null, 2));

  console.log('\n✅ All tests passed!');
}

testApplySuggestion().catch(console.error);
