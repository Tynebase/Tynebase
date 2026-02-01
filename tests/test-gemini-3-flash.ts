/**
 * Test gemini-3-flash-preview model
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

async function test() {
  console.log('🔍 Testing gemini-3-flash-preview...\n');
  
  const credentials = getServiceAccountCredentials();
  const projectId = credentials.project_id;
  
  console.log(`Project: ${projectId}`);
  console.log(`Service Account: ${credentials.client_email}\n`);
  
  const vertexAI = new VertexAI({
    project: projectId,
    location: 'europe-west2',
    googleAuthOptions: { credentials },
  });

  const modelsToTry = [
    'gemini-3-flash-preview',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
  ];

  console.log('Testing available models in europe-west2...\n');
  
  for (const modelName of modelsToTry) {
    try {
      process.stdout.write(`Trying ${modelName}... `);
      const model = vertexAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        generationConfig: { maxOutputTokens: 10 },
      });
      
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage = result.response.usageMetadata;
      
      console.log('✅ WORKS!\n');
      console.log('✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log(`Working model: ${modelName}`);
      console.log(`Region: europe-west2`);
      console.log('\nFull test response:');
      console.log('─'.repeat(60));
      
      const fullResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Say "Hello from Gemini!" and confirm you are working correctly.' }] }],
        generationConfig: { maxOutputTokens: 100 },
      });
      
      console.log(fullResult.response.candidates?.[0]?.content?.parts?.[0]?.text);
      console.log('─'.repeat(60));
      console.log('\n📊 Token Usage:');
      console.log(`   Input: ${fullResult.response.usageMetadata?.promptTokenCount || 0}`);
      console.log(`   Output: ${fullResult.response.usageMetadata?.candidatesTokenCount || 0}`);
      console.log(`   Total: ${fullResult.response.usageMetadata?.totalTokenCount || 0}\n`);
      return;
      
    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.log('❌ Not found');
      } else if (error.message?.includes('403')) {
        console.log('❌ Permission denied');
      } else {
        console.log(`❌ ${error.message.substring(0, 50)}`);
      }
    }
  }
  
  console.log('\n❌ No working models found in europe-west2.');
  console.log('\nYou need to enable Generative AI in Vertex AI Studio:');
  console.log(`https://console.cloud.google.com/vertex-ai/generative?project=${projectId}`);
}

test();
