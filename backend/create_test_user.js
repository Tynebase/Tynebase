/**
 * Create Test User and Get JWT Token
 * 
 * This script creates a test user in Supabase Auth and the users table,
 * then retrieves a JWT token for validation testing.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const TEST_TENANT_ID = '1521f0ae-4db7-4110-a993-c494535d9b00';
const TEST_EMAIL = 'testuser@tynebase.test';
const TEST_PASSWORD = 'TestPassword123!';

async function createTestUser() {
  console.log('=== Creating Test User for JWT Validation ===\n');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('✅ Auth user already exists');
        
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === TEST_EMAIL);
        
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }
        
        console.log(`   User ID: ${existingUser.id}`);
        
        console.log('\nStep 2: Checking users table...');
        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', existingUser.id)
          .single();

        if (dbError || !dbUser) {
          console.log('   Creating user in users table...');
          const { error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
              id: existingUser.id,
              tenant_id: TEST_TENANT_ID,
              email: TEST_EMAIL,
              full_name: 'Test User',
              role: 'admin',
              is_super_admin: false,
              status: 'active',
            });

          if (insertError) {
            throw insertError;
          }
          console.log('✅ User created in users table');
        } else {
          console.log('✅ User already exists in users table');
        }

        return existingUser.id;
      } else {
        throw authError;
      }
    }

    console.log('✅ Auth user created');
    console.log(`   User ID: ${authData.user.id}`);

    console.log('\nStep 2: Creating user in users table...');
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        tenant_id: TEST_TENANT_ID,
        email: TEST_EMAIL,
        full_name: 'Test User',
        role: 'admin',
        is_super_admin: false,
        status: 'active',
      });

    if (dbError) {
      throw dbError;
    }

    console.log('✅ User created in users table');
    return authData.user.id;

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    throw error;
  }
}

async function getJWTToken() {
  console.log('\nStep 3: Getting JWT token...');
  
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw error;
  }

  console.log('✅ JWT token obtained');
  console.log('\n=== Test User Credentials ===');
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`User ID: ${data.user.id}`);
  console.log(`Tenant ID: ${TEST_TENANT_ID}`);
  console.log('\n=== JWT Token ===');
  console.log(data.session.access_token);
  console.log('\n=== Run Validation ===');
  console.log(`TEST_JWT_TOKEN="${data.session.access_token}" node test_auth_middleware.js`);
  
  return data.session.access_token;
}

async function main() {
  try {
    await createTestUser();
    await getJWTToken();
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

main();
