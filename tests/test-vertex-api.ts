/**
 * Test script for Google Vertex AI API connection
 * Tests authentication and basic text generation with Gemini
 */

import { VertexAI } from '@google-cloud/vertexai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Parse service account credentials from environment
 */
function getServiceAccountCredentials(): any {
  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!gcpJson) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  try {
    // Check if it's base64 encoded
    const decoded = Buffer.from(gcpJson, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    // If not base64, try parsing as direct JSON
    try {
      return JSON.parse(gcpJson);
    } catch (err) {
      throw new Error('Failed to parse GCP_SERVICE_ACCOUNT_JSON');
    }
  }
}

async function testVertexAI() {
  console.log('🔍 Testing Google Vertex AI API Connection...\n');

  try {
    // Get credentials
    console.log('📋 Step 1: Loading credentials...');
    const credentials = getServiceAccountCredentials();
    const projectId = credentials.project_id;
    console.log(`✅ Project ID: ${projectId}`);
    console.log(`✅ Service Account: ${credentials.client_email}`);
    console.log(`\n⚠️  If you get a 404 error, you need to enable the Vertex AI API:`);
    console.log(`   https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=${projectId}\n`);

    // Initialize Vertex AI client
    console.log('📋 Step 2: Initializing Vertex AI client...');
    const vertexAI = new VertexAI({
      project: projectId,
      location: 'us-central1',
      googleAuthOptions: {
        credentials: credentials,
      },
    });
    console.log('✅ Vertex AI client initialized (us-central1)\n');

    // Try different model names
    console.log('📋 Step 3: Testing available Gemini models...\n');
    
    const modelsToTry = [
      'gemini-1.5-flash-002',
      'gemini-1.5-pro-002', 
      'gemini-1.0-pro-002',
      'gemini-1.0-pro',
    ];

    let workingModel = null;
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`   Trying: ${modelName}...`);
        const model = vertexAI.getGenerativeModel({ model: modelName });
        
        const testRequest = {
          contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 10 },
        };
        
        await model.generateContent(testRequest);
        console.log(`   ✅ ${modelName} works!\n`);
        workingModel = modelName;
        break;
      } catch (err: any) {
        if (err.message?.includes('403') || err.message?.includes('PERMISSION_DENIED')) {
          console.log(`   ❌ Permission denied - need to grant IAM roles`);
          throw new Error('Service account needs "Vertex AI User" role. Add it at: https://console.cloud.google.com/iam-admin/iam?project=' + projectId);
        }
        console.log(`   ❌ ${modelName} not available`);
      }
    }

    if (!workingModel) {
      throw new Error('No working Gemini models found. Check model availability in your region.');
    }

    const model = vertexAI.getGenerativeModel({ model: workingModel });
    console.log(`✅ Using model: ${workingModel}\n`);

    // Test text generation
    console.log('📋 Step 4: Full text generation test...');
    const prompt = 'Say "Hello from Gemini!" and confirm you are working correctly.';
    console.log(`Prompt: "${prompt}"\n`);

    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7,
      },
    };

    const result = await model.generateContent(request);
    const response = result.response;
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('✅ Response received:\n');
    console.log('─'.repeat(60));
    console.log(content);
    console.log('─'.repeat(60));
    console.log('');

    // Display token usage
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      console.log('📊 Token Usage:');
      console.log(`   Input tokens: ${usageMetadata.promptTokenCount || 0}`);
      console.log(`   Output tokens: ${usageMetadata.candidatesTokenCount || 0}`);
      console.log(`   Total tokens: ${usageMetadata.totalTokenCount || 0}\n`);
    }

    console.log('✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅');
    console.log('Google Vertex AI is configured correctly and working!\n');

  } catch (error: any) {
    console.error('❌ TEST FAILED!\n');
    console.error('Error details:');
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Run the test
testVertexAI();
