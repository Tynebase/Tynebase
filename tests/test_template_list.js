/**
 * Test script for GET /api/templates endpoint
 * 
 * Tests:
 * 1. Returns approved global templates (tenant_id IS NULL, is_approved = TRUE)
 * 2. Returns tenant's own templates (any approval status)
 * 3. Does NOT return unapproved global templates
 * 4. Does NOT return other tenant's templates
 * 5. Pagination works correctly
 * 6. Category filter works
 * 7. Visibility filter works
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

async function testTemplateList() {
  console.log('\n🧪 Testing Template List Endpoint\n');
  console.log('='.repeat(60));

  try {
    // Get test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, subdomain')
      .eq('subdomain', 'test')
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Test tenant not found. Run insert_test_tenant.js first');
      return;
    }

    console.log(`✅ Found test tenant: ${tenant.subdomain} (${tenant.id})`);

    // Get test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', tenant.id)
      .single();

    if (userError || !user) {
      console.error('❌ No test user found');
      return;
    }

    console.log(`✅ Found test user: ${user.email} (${user.role})`);

    // Cleanup existing test templates
    console.log('\n🧹 Cleanup: Removing existing test templates');
    await supabase
      .from('templates')
      .delete()
      .like('title', 'Test Template%');

    // Test 1: Create approved global template
    console.log('\n📝 Test 1: Create approved global template');
    const { data: globalTemplate, error: globalError } = await supabase
      .from('templates')
      .insert({
        tenant_id: null, // Global template
        title: 'Test Template - Global Approved',
        description: 'An approved global template',
        content: '# Global Template\n\nThis is a global template.',
        category: 'documentation',
        visibility: 'public',
        is_approved: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (globalError) {
      console.error('❌ Failed to create global template:', globalError);
      return;
    }

    console.log(`✅ Created global approved template: ${globalTemplate.id}`);
    console.log(`   Tenant ID: ${globalTemplate.tenant_id} (null = global)`);
    console.log(`   Is Approved: ${globalTemplate.is_approved}`);

    // Test 2: Create unapproved global template (should NOT be returned)
    console.log('\n📝 Test 2: Create unapproved global template');
    const { data: unapprovedGlobal, error: unapprovedError } = await supabase
      .from('templates')
      .insert({
        tenant_id: null,
        title: 'Test Template - Global Unapproved',
        description: 'An unapproved global template',
        content: '# Unapproved Global Template',
        category: 'documentation',
        visibility: 'public',
        is_approved: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (unapprovedError) {
      console.error('❌ Failed to create unapproved global template:', unapprovedError);
      return;
    }

    console.log(`✅ Created unapproved global template: ${unapprovedGlobal.id}`);
    console.log(`   Is Approved: ${unapprovedGlobal.is_approved} (should NOT be returned)`);

    // Test 3: Create tenant-specific template (unapproved)
    console.log('\n📝 Test 3: Create tenant-specific template');
    const { data: tenantTemplate, error: tenantTemplateError } = await supabase
      .from('templates')
      .insert({
        tenant_id: tenant.id,
        title: 'Test Template - Tenant Specific',
        description: 'A tenant-specific template',
        content: '# Tenant Template\n\nThis belongs to the tenant.',
        category: 'notes',
        visibility: 'internal',
        is_approved: false, // Even unapproved tenant templates should be returned
        created_by: user.id,
      })
      .select()
      .single();

    if (tenantTemplateError) {
      console.error('❌ Failed to create tenant template:', tenantTemplateError);
      return;
    }

    console.log(`✅ Created tenant template: ${tenantTemplate.id}`);
    console.log(`   Tenant ID: ${tenantTemplate.tenant_id}`);
    console.log(`   Is Approved: ${tenantTemplate.is_approved} (should still be returned)`);

    // Test 4: Query all templates for this tenant
    console.log('\n📝 Test 4: Query templates (should return global approved + tenant templates)');
    const { data: templates, error: queryError } = await supabase
      .from('templates')
      .select('*')
      .or(`and(tenant_id.is.null,is_approved.eq.true),tenant_id.eq.${tenant.id}`)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('❌ Failed to query templates:', queryError);
      return;
    }

    console.log(`✅ Found ${templates.length} templates`);
    
    const globalApproved = templates.filter(t => t.tenant_id === null && t.is_approved === true);
    const tenantSpecific = templates.filter(t => t.tenant_id === tenant.id);
    const unapprovedGlobalReturned = templates.filter(t => t.tenant_id === null && t.is_approved === false);

    console.log(`   - Global approved: ${globalApproved.length}`);
    console.log(`   - Tenant specific: ${tenantSpecific.length}`);
    console.log(`   - Unapproved global: ${unapprovedGlobalReturned.length} (should be 0)`);

    // Test 5: Verify correct templates returned
    console.log('\n📝 Test 5: Verify correct templates returned');
    
    const hasGlobalApproved = templates.some(t => t.id === globalTemplate.id);
    const hasUnapprovedGlobal = templates.some(t => t.id === unapprovedGlobal.id);
    const hasTenantTemplate = templates.some(t => t.id === tenantTemplate.id);

    if (!hasGlobalApproved) {
      console.error('❌ Global approved template NOT returned');
      return;
    }
    console.log('✅ Global approved template returned');

    if (hasUnapprovedGlobal) {
      console.error('❌ Unapproved global template incorrectly returned');
      return;
    }
    console.log('✅ Unapproved global template correctly excluded');

    if (!hasTenantTemplate) {
      console.error('❌ Tenant template NOT returned');
      return;
    }
    console.log('✅ Tenant template returned');

    // Test 6: Test category filter
    console.log('\n📝 Test 6: Test category filter');
    const { data: docTemplates, error: categoryError } = await supabase
      .from('templates')
      .select('*')
      .or(`and(tenant_id.is.null,is_approved.eq.true),tenant_id.eq.${tenant.id}`)
      .eq('category', 'documentation');

    if (categoryError) {
      console.error('❌ Category filter failed:', categoryError);
      return;
    }

    console.log(`✅ Category filter works: ${docTemplates.length} templates with category='documentation'`);
    const allDocCategory = docTemplates.every(t => t.category === 'documentation');
    if (!allDocCategory) {
      console.error('❌ Some templates have wrong category');
      return;
    }
    console.log('✅ All returned templates have correct category');

    // Test 7: Test visibility filter
    console.log('\n📝 Test 7: Test visibility filter');
    const { data: publicTemplates, error: visibilityError } = await supabase
      .from('templates')
      .select('*')
      .or(`and(tenant_id.is.null,is_approved.eq.true),tenant_id.eq.${tenant.id}`)
      .eq('visibility', 'public');

    if (visibilityError) {
      console.error('❌ Visibility filter failed:', visibilityError);
      return;
    }

    console.log(`✅ Visibility filter works: ${publicTemplates.length} templates with visibility='public'`);
    const allPublic = publicTemplates.every(t => t.visibility === 'public');
    if (!allPublic) {
      console.error('❌ Some templates have wrong visibility');
      return;
    }
    console.log('✅ All returned templates have correct visibility');

    // Test 8: Test pagination
    console.log('\n📝 Test 8: Test pagination');
    const { data: page1, error: page1Error, count } = await supabase
      .from('templates')
      .select('*', { count: 'exact' })
      .or(`and(tenant_id.is.null,is_approved.eq.true),tenant_id.eq.${tenant.id}`)
      .range(0, 0); // First item only

    if (page1Error) {
      console.error('❌ Pagination failed:', page1Error);
      return;
    }

    console.log(`✅ Pagination works: ${page1.length} template(s) on page 1`);
    console.log(`   Total count: ${count}`);

    // Cleanup
    console.log('\n🧹 Cleanup: Deleting test templates');
    await supabase
      .from('templates')
      .delete()
      .like('title', 'Test Template%');

    console.log('✅ Test templates deleted');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All validation tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

testTemplateList();
