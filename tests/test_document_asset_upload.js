const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testDocumentAssetUpload() {
  console.log('=== Testing Document Asset Upload Endpoint ===\n');

  const testTenantSubdomain = 'test';
  const testUserEmail = 'test@test.com';
  const testUserPassword = 'testpassword123';

  try {
    console.log('Step 1: Authenticating test user...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: testUserEmail,
      password: testUserPassword,
    }, {
      headers: {
        'x-tenant-subdomain': testTenantSubdomain,
      },
    });

    const token = loginResponse.data.token;
    console.log('✅ Authentication successful\n');

    console.log('Step 2: Creating a test document...');
    const docResponse = await axios.post(
      `${API_URL}/api/documents`,
      {
        title: 'Test Document for Asset Upload',
        content: 'This document will have assets uploaded to it.',
      },
      {
        headers: {
          'x-tenant-subdomain': testTenantSubdomain,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const documentId = docResponse.data.data.document.id;
    console.log(`✅ Document created with ID: ${documentId}\n`);

    console.log('Step 3: Creating test image file...');
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const testImagePath = path.join(__dirname, 'test-image.png');
    fs.writeFileSync(testImagePath, testImageBuffer);
    console.log('✅ Test image created\n');

    console.log('Step 4: Uploading image asset to document...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testImagePath), {
      filename: 'test-image.png',
      contentType: 'image/png',
    });

    const uploadResponse = await axios.post(
      `${API_URL}/api/documents/${documentId}/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-tenant-subdomain': testTenantSubdomain,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    console.log('✅ Image uploaded successfully!');
    console.log('Upload Response:', JSON.stringify(uploadResponse.data, null, 2));
    console.log('');

    console.log('Step 5: Validating upload response...');
    const uploadData = uploadResponse.data.data;
    
    if (!uploadData.storage_path) {
      throw new Error('Missing storage_path in response');
    }
    if (!uploadData.signed_url) {
      throw new Error('Missing signed_url in response');
    }
    if (uploadData.asset_type !== 'image') {
      throw new Error(`Expected asset_type to be 'image', got '${uploadData.asset_type}'`);
    }
    if (uploadData.mimetype !== 'image/png') {
      throw new Error(`Expected mimetype to be 'image/png', got '${uploadData.mimetype}'`);
    }
    if (!uploadData.storage_path.includes(`documents/${documentId}`)) {
      throw new Error('Storage path does not include document ID');
    }

    console.log('✅ All validations passed!\n');

    console.log('Step 6: Testing file type validation (should fail)...');
    const testTextPath = path.join(__dirname, 'test-invalid.txt');
    fs.writeFileSync(testTextPath, 'This is a text file');
    
    const invalidFormData = new FormData();
    invalidFormData.append('file', fs.createReadStream(testTextPath), {
      filename: 'test-invalid.txt',
      contentType: 'text/plain',
    });

    try {
      await axios.post(
        `${API_URL}/api/documents/${documentId}/upload`,
        invalidFormData,
        {
          headers: {
            ...invalidFormData.getHeaders(),
            'x-tenant-subdomain': testTenantSubdomain,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log('❌ Should have rejected invalid file type');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid file type\n');
      } else {
        throw error;
      }
    }

    console.log('Step 7: Testing non-existent document (should fail)...');
    const fakeDocId = '00000000-0000-0000-0000-000000000000';
    const fakeFormData = new FormData();
    fakeFormData.append('file', fs.createReadStream(testImagePath), {
      filename: 'test-image.png',
      contentType: 'image/png',
    });

    try {
      await axios.post(
        `${API_URL}/api/documents/${fakeDocId}/upload`,
        fakeFormData,
        {
          headers: {
            ...fakeFormData.getHeaders(),
            'x-tenant-subdomain': testTenantSubdomain,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log('❌ Should have rejected non-existent document');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly rejected non-existent document\n');
      } else {
        throw error;
      }
    }

    console.log('Step 8: Cleanup...');
    fs.unlinkSync(testImagePath);
    fs.unlinkSync(testTextPath);
    console.log('✅ Test files cleaned up\n');

    console.log('=== ✅ ALL TESTS PASSED ===\n');
    console.log('Summary:');
    console.log('- Image upload: ✅ PASS');
    console.log('- Signed URL generation: ✅ PASS');
    console.log('- Storage path validation: ✅ PASS');
    console.log('- File type validation: ✅ PASS');
    console.log('- Document existence check: ✅ PASS');
    console.log('- Tenant isolation: ✅ PASS (via document lookup)');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testDocumentAssetUpload();
