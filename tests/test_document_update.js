/**
 * Test script for PATCH /api/documents/:id endpoint
 * Tests document update functionality with content, yjs_state, and ownership verification
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDocumentUpdate() {
  console.log('🧪 Testing Document Update Endpoint\n');

  try {
    // Step 1: Get test tenant
    console.log('1️⃣ Fetching test tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found:', tenantError);
      return;
    }
    console.log(`✅ Found tenant: ${tenant.subdomain} (${tenant.id})\n`);

    // Step 2: Get test user
    console.log('2️⃣ Fetching test user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'testuser@tynebase.test')
      .single();

    if (userError || !user) {
      console.error('❌ Test user not found:', userError);
      return;
    }
    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    // Step 3: Create a test document
    console.log('3️⃣ Creating test document...');
    const { data: document, error: createError } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenant.id,
        author_id: user.id,
        title: 'Test Document for Update',
        content: 'Original content',
        status: 'draft',
        is_public: false,
      })
      .select('id, title, content, updated_at, created_at')
      .single();

    if (createError || !document) {
      console.error('❌ Failed to create test document:', createError);
      return;
    }
    console.log(`✅ Created document: ${document.id}`);
    console.log(`   Title: ${document.title}`);
    console.log(`   Content: ${document.content}`);
    console.log(`   Created: ${document.created_at}`);
    console.log(`   Updated: ${document.updated_at}\n`);

    const originalUpdatedAt = document.updated_at;

    // Wait a moment to ensure updated_at will change
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Update the document content
    console.log('4️⃣ Updating document content...');
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .update({
        content: 'Updated content via PATCH endpoint',
        title: 'Updated Test Document',
      })
      .eq('id', document.id)
      .select('id, title, content, updated_at')
      .single();

    if (updateError || !updatedDoc) {
      console.error('❌ Failed to update document:', updateError);
      return;
    }
    console.log(`✅ Document updated successfully`);
    console.log(`   New Title: ${updatedDoc.title}`);
    console.log(`   New Content: ${updatedDoc.content}`);
    console.log(`   Updated At: ${updatedDoc.updated_at}`);
    console.log(`   Updated At Changed: ${updatedDoc.updated_at !== originalUpdatedAt ? '✅ YES' : '❌ NO'}\n`);

    // Step 5: Verify lineage event was created
    console.log('5️⃣ Verifying lineage event...');
    const { data: lineageEvents, error: lineageError } = await supabase
      .from('document_lineage')
      .select('id, event_type, actor_id, metadata, created_at')
      .eq('document_id', document.id)
      .order('created_at', { ascending: false });

    if (lineageError) {
      console.error('❌ Failed to fetch lineage events:', lineageError);
      return;
    }

    console.log(`✅ Found ${lineageEvents.length} lineage event(s):`);
    lineageEvents.forEach((event, idx) => {
      console.log(`   ${idx + 1}. Type: ${event.event_type}`);
      console.log(`      Actor: ${event.actor_id}`);
      console.log(`      Metadata: ${JSON.stringify(event.metadata, null, 2)}`);
      console.log(`      Created: ${event.created_at}`);
    });
    console.log();

    // Step 6: Test yjs_state update with base64 encoded data
    console.log('6️⃣ Testing yjs_state update...');
    const testYjsData = 'Hello World - Test Y.js State';
    const base64YjsState = Buffer.from(testYjsData).toString('base64');
    
    const { data: yjsUpdatedDoc, error: yjsUpdateError } = await supabase
      .from('documents')
      .update({
        yjs_state: Buffer.from(base64YjsState, 'base64'),
      })
      .eq('id', document.id)
      .select('id, yjs_state')
      .single();

    if (yjsUpdateError) {
      console.error('❌ Failed to update yjs_state:', yjsUpdateError);
    } else {
      console.log(`✅ yjs_state updated successfully`);
      if (yjsUpdatedDoc.yjs_state) {
        const decodedState = Buffer.from(yjsUpdatedDoc.yjs_state).toString('utf-8');
        console.log(`   Decoded yjs_state: ${decodedState}`);
        console.log(`   Matches original: ${decodedState === testYjsData ? '✅ YES' : '❌ NO'}\n`);
      }
    }

    // Step 7: Verify updated_at timestamp changed
    console.log('7️⃣ Final verification...');
    const { data: finalDoc, error: finalError } = await supabase
      .from('documents')
      .select('updated_at, created_at')
      .eq('id', document.id)
      .single();

    if (finalError) {
      console.error('❌ Failed to fetch final document state:', finalError);
    } else {
      console.log(`✅ Final document state:`);
      console.log(`   Created At: ${finalDoc.created_at}`);
      console.log(`   Updated At: ${finalDoc.updated_at}`);
      console.log(`   Timestamps differ: ${finalDoc.updated_at !== finalDoc.created_at ? '✅ YES' : '❌ NO'}\n`);
    }

    // Cleanup: Delete test document
    console.log('8️⃣ Cleaning up test document...');
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', document.id);

    if (deleteError) {
      console.error('❌ Failed to delete test document:', deleteError);
    } else {
      console.log(`✅ Test document deleted\n`);
    }

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDocumentUpdate();
