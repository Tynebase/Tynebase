/**
 * Test Vertex AI across different regions and model versions
 */

import { VertexAI } from '@google-cloud/vertexai';
import * as dotenv from 'dotenv';

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

async function testRegionAndModel(projectId: string, credentials: any, region: string, model: string) {
  try {
    const vertexAI = new VertexAI({
      project: projectId,
      location: region,
      googleAuthOptions: { credentials },
    });

    const geminiModel = vertexAI.getGenerativeModel({ model });
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      generationConfig: { maxOutputTokens: 10 },
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    return { success: true, text };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function test() {
  console.log('🔍 Testing Vertex AI across regions and models...\n');
  
  const credentials = getServiceAccountCredentials();
  const projectId = credentials.project_id;
  
  console.log(`Project: ${projectId}\n`);

  const regions = ['us-central1', 'europe-west2', 'us-east4', 'asia-southeast1'];
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-1.0-pro',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',
  ];

  console.log('Testing combinations...\n');

  for (const region of regions) {
    for (const model of models) {
      process.stdout.write(`${region.padEnd(20)} ${model.padEnd(25)} ... `);
      
      const result = await testRegionAndModel(projectId, credentials, region, model);
      
      if (result.success) {
        console.log('✅ WORKS!');
        console.log(`\n🎉 Found working configuration:`);
        console.log(`   Region: ${region}`);
        console.log(`   Model: ${model}`);
        console.log(`   Response: ${result.text}\n`);
        return;
      } else {
        if (result.error.includes('403') || result.error.includes('PERMISSION')) {
          console.log('❌ Permission denied');
        } else if (result.error.includes('404')) {
          console.log('❌ Not found');
        } else {
          console.log(`❌ ${result.error.substring(0, 30)}...`);
        }
      }
    }
  }

  console.log('\n❌ No working configuration found.');
  console.log('\nThis means Generative AI is not enabled for your project.');
  console.log('You need to:');
  console.log('1. Go to Vertex AI Studio in Google Cloud Console');
  console.log('2. Navigate to the Generative AI section');
  console.log('3. Accept the terms of service');
  console.log('4. Enable Generative AI features');
  console.log(`\nDirect link: https://console.cloud.google.com/vertex-ai?project=${projectId}`);
}

test();
