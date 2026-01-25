const { createClient } = require('@supabase/supabase-js');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testVideoUpload() {
  console.log('=== Testing Video Upload Endpoint ===\n');

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

  console.log('\nStep 2: Create a test video file...');
  const testVideoPath = path.join(__dirname, 'test_video.mp4');
  
  if (!fs.existsSync(testVideoPath)) {
    console.log('   Creating dummy video file for testing...');
    const dummyVideoData = Buffer.alloc(1024 * 100);
    fs.writeFileSync(testVideoPath, dummyVideoData);
    console.log('   ✅ Created test file:', testVideoPath);
  } else {
    console.log('   ✅ Using existing test file:', testVideoPath);
  }

  const fileStats = fs.statSync(testVideoPath);
  console.log('   File size:', fileStats.size, 'bytes');

  console.log('\nStep 3: Upload video file...');
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testVideoPath), {
    filename: 'test_video.mp4',
    contentType: 'video/mp4',
  });

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${backendUrl}/api/ai/video/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Subdomain': 'test',
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Upload failed:', response.status);
      console.error('   Error:', JSON.stringify(responseData, null, 2));
      return;
    }

    console.log('✅ Upload successful!');
    console.log('   Response:', JSON.stringify(responseData, null, 2));

    const jobId = responseData.job_id;
    const storagePath = responseData.storage_path;

    console.log('\nStep 4: Verify file in Supabase Storage...');
    const { data: fileList, error: listError } = await supabaseAdmin
      .storage
      .from('tenant-uploads')
      .list('tenant-1521f0ae-4db7-4110-a993-c494535d9b00');

    if (listError) {
      console.error('❌ Failed to list storage files:', listError.message);
      return;
    }

    const uploadedFile = fileList.find(f => storagePath.includes(f.name));
    if (uploadedFile) {
      console.log('✅ File found in storage');
      console.log('   File name:', uploadedFile.name);
      console.log('   File size:', uploadedFile.metadata?.size || 'unknown');
    } else {
      console.error('❌ File not found in storage');
      console.log('   Storage path:', storagePath);
      console.log('   Available files:', fileList.map(f => f.name));
    }

    console.log('\nStep 5: Verify job was created...');
    const { data: job, error: jobError } = await supabaseAdmin
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('❌ Failed to fetch job:', jobError.message);
      return;
    }

    console.log('✅ Job created successfully');
    console.log('   Job ID:', job.id);
    console.log('   Job type:', job.type);
    console.log('   Job status:', job.status);
    console.log('   Payload:', JSON.stringify(job.payload, null, 2));

    console.log('\nStep 6: Cleanup - Delete test file from storage...');
    const { error: deleteError } = await supabaseAdmin
      .storage
      .from('tenant-uploads')
      .remove([storagePath]);

    if (deleteError) {
      console.warn('⚠️  Failed to delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file deleted from storage');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testVideoUpload().catch(console.error);
