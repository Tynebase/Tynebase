/**
 * Test Google Generative Language API (direct Gemini API)
 * This uses generativelanguage.googleapis.com instead of Vertex AI
 */

import * as dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

function getServiceAccountCredentials(): any {
  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!gcpJson) throw new Error('GCP_SERVICE_ACCOUNT_JSON not set');
  
  try {
    const decoded = Buffer.from(gcpJson, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    return JSON.parse(gcpJson);
  }
}

async function testGenerativeLanguageAPI() {
  console.log('🔍 Testing Google Generative Language API...\n');
  
  const credentials = getServiceAccountCredentials();
  console.log(`Project: ${credentials.project_id}`);
  console.log(`Service Account: ${credentials.client_email}\n`);

  try {
    // Create auth client
    const auth = new GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Authentication successful\n');
    console.log('📋 Testing Gemini API...\n');

    // Call Gemini API
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "Hello from Gemini!" and confirm you are working correctly.'
            }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log('❌ API Error:\n');
      console.log(JSON.stringify(data, null, 2));
      
      if (response.status === 403) {
        console.log('\n⚠️  Permission denied. Your service account needs access to Generative Language API.');
      } else if (response.status === 404) {
        console.log('\n⚠️  Model not found. The Generative Language API might not support service account auth.');
        console.log('Note: This API typically requires an API key instead of service account credentials.');
      }
      return;
    }

    console.log('✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text');
    console.log('─'.repeat(60));
    
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

testGenerativeLanguageAPI();
