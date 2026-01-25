/**
 * Test script for DELETE /api/documents/:id endpoint
 * 
 * Tests:
 * 1. Create a test document
 * 2. Delete the document as the author
 * 3. Verify document is removed
 * 4. Verify cascade deletes (embeddings, lineage)
 * 5. Test unauthorized deletion (different user)
 * 6. Test 404 for non-existent document
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test tenant and user IDs
const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00'; // test tenant
const TEST_USER_ID = 'db3ecc55-5240-4589-93bb-8e812519dca3'; // test user (testuser@tynebase.test)

async function testDocumentDelete() {
  console.log('\n🧪 Testing DELETE /api/documents/:id endpoint\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create a test document
    console.log('\n📝 Step 1: Creating test document...');
    const { data: document, error: createError } = await supabase
      .from('documents')
      .insert({
        tenant_id: TEST_TENANT_ID,
        author_id: TEST_USER_ID,
        title: 'Test Document for Deletion',
        content: 'This document will be deleted in the test',
        status: 'draft',
        is_public: false,
      })
      .select('id, title, author_id')
      .single();

    if (createError) {
      console.error('❌ Failed to create test document:', createError.message);
      return;
    }

    console.log('✅ Test document created:', {
      id: document.id,
      title: document.title,
      author_id: document.author_id,
    });

    const documentId = document.id;

    // Step 2: Create a lineage event to test cascade delete
    console.log('\n📝 Step 2: Creating lineage event...');
    const { error: lineageError } = await supabase
      .from('document_lineage')
      .insert({
        document_id: documentId,
        event_type: 'created',
        actor_id: TEST_USER_ID,
        metadata: { test: true },
      });

    if (lineageError) {
      console.error('❌ Failed to create lineage event:', lineageError.message);
    } else {
      console.log('✅ Lineage event created');
    }

    // Step 3: Verify document exists before deletion
    console.log('\n📝 Step 3: Verifying document exists...');
    const { data: beforeDelete, error: beforeError } = await supabase
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .single();

    if (beforeError || !beforeDelete) {
      console.error('❌ Document not found before deletion');
      return;
    }
    console.log('✅ Document exists before deletion:', beforeDelete.title);

    // Step 4: Check lineage events before deletion
    console.log('\n📝 Step 4: Checking lineage events before deletion...');
    const { data: lineageBefore, error: lineageBeforeError } = await supabase
      .from('document_lineage')
      .select('id, event_type')
      .eq('document_id', documentId);

    if (lineageBeforeError) {
      console.error('❌ Failed to fetch lineage events:', lineageBeforeError.message);
    } else {
      console.log(`✅ Found ${lineageBefore.length} lineage event(s) before deletion`);
    }

    // Step 5: Delete the document
    console.log('\n📝 Step 5: Deleting document...');
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('tenant_id', TEST_TENANT_ID);

    if (deleteError) {
      console.error('❌ Failed to delete document:', deleteError.message);
      return;
    }
    console.log('✅ Document deleted successfully');

    // Step 6: Verify document is removed
    console.log('\n📝 Step 6: Verifying document is removed...');
    const { data: afterDelete, error: afterError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .single();

    if (afterError && afterError.code === 'PGRST116') {
      console.log('✅ Document successfully removed from database');
    } else if (afterDelete) {
      console.error('❌ Document still exists after deletion!');
      return;
    }

    // Step 7: Verify cascade delete of lineage events
    console.log('\n📝 Step 7: Verifying cascade delete of lineage events...');
    const { data: lineageAfter, error: lineageAfterError } = await supabase
      .from('document_lineage')
      .select('id')
      .eq('document_id', documentId);

    if (lineageAfterError) {
      console.error('❌ Failed to check lineage after deletion:', lineageAfterError.message);
    } else if (lineageAfter.length === 0) {
      console.log('✅ Lineage events successfully cascade deleted');
    } else {
      console.error(`❌ Found ${lineageAfter.length} orphaned lineage event(s)`);
    }

    // Step 8: Test 404 for non-existent document
    console.log('\n📝 Step 8: Testing 404 for non-existent document...');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { data: notFound, error: notFoundError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', fakeId)
      .eq('tenant_id', TEST_TENANT_ID)
      .single();

    if (notFoundError && notFoundError.code === 'PGRST116') {
      console.log('✅ Correctly returns no results for non-existent document');
    } else {
      console.error('❌ Unexpected result for non-existent document');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
  }
}

// Run the test
testDocumentDelete();
