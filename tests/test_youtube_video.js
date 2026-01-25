const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testYouTubeVideoEndpoint() {
  console.log('=== Testing YouTube Video Endpoint ===\n');

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

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  console.log('\nStep 2: Test valid YouTube URL...');
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ];

  for (const url of testUrls) {
    console.log(`\n   Testing URL: ${url}`);
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${backendUrl}/api/ai/video/youtube`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': 'test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('   ❌ Request failed:', response.status);
        console.error('      Error:', JSON.stringify(responseData, null, 2));
        continue;
      }

      console.log('   ✅ Request successful!');
      console.log('      Job ID:', responseData.job_id);
      console.log('      URL:', responseData.url);
      console.log('      Status:', responseData.status);

      const jobId = responseData.job_id;

      console.log('   Step 3: Verify job was created...');
      const { data: job, error: jobError } = await supabaseAdmin
        .from('job_queue')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('   ❌ Failed to fetch job:', jobError.message);
        continue;
      }

      console.log('   ✅ Job created successfully');
      console.log('      Job ID:', job.id);
      console.log('      Job type:', job.type);
      console.log('      Job status:', job.status);
      console.log('      Payload:', JSON.stringify(job.payload, null, 2));

      if (job.type !== 'video_ingest_youtube') {
        console.error('   ❌ Incorrect job type. Expected: video_ingest_youtube, Got:', job.type);
      } else {
        console.log('   ✅ Job type is correct');
      }

      if (job.payload.url !== url) {
        console.error('   ❌ URL mismatch in payload');
      } else {
        console.log('   ✅ URL matches in payload');
      }

    } catch (error) {
      console.error('   ❌ Test failed:', error.message);
    }
  }

  console.log('\n\nStep 4: Test invalid URLs (should fail)...');
  const invalidUrls = [
    'https://www.google.com',
    'https://vimeo.com/123456',
    'not-a-url',
    'https://youtube.com/invalid',
  ];

  for (const url of invalidUrls) {
    console.log(`\n   Testing invalid URL: ${url}`);
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${backendUrl}/api/ai/video/youtube`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': 'test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const responseData = await response.json();

      if (response.status === 400) {
        console.log('   ✅ Correctly rejected invalid URL');
        console.log('      Error code:', responseData.error?.code);
        console.log('      Error message:', responseData.error?.message);
      } else {
        console.error('   ❌ Should have rejected invalid URL but got status:', response.status);
        console.error('      Response:', JSON.stringify(responseData, null, 2));
      }

    } catch (error) {
      console.error('   ❌ Test failed:', error.message);
    }
  }

  console.log('\n\n✅ All YouTube video endpoint tests completed!');
}

testYouTubeVideoEndpoint().catch(console.error);
