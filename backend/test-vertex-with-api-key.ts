/**
 * Test Vertex AI using API Key instead of service account
 */

import { VertexAI } from '@google-cloud/vertexai';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🔍 Testing Vertex AI with API Key...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_API_KEY not found in .env');
    return;
  }
  
  if (!projectId) {
    console.log('❌ GOOGLE_CLOUD_PROJECT not found in .env');
    return;
  }
  
  console.log(`Project: ${projectId}`);
  console.log(`API Key: ${apiKey.substring(0, 15)}...\n`);
  
  const vertexAI = new VertexAI({
    project: projectId,
    location: 'europe-west2',
    apiKey: apiKey,
  });

  const modelsToTry = [
    'gemini-3-flash-preview',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
  ];

  console.log('Testing models in europe-west2...\n');
  
  for (const modelName of modelsToTry) {
    try {
      process.stdout.write(`Trying ${modelName}... `);
      const model = vertexAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Say "Hello from Gemini!" and confirm you are working.' }] }],
        generationConfig: { maxOutputTokens: 100 },
      });
      
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage = result.response.usageMetadata;
      
      console.log('✅ WORKS!\n');
      console.log('✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log(`Working model: ${modelName}`);
      console.log(`Region: europe-west2`);
      console.log(`Auth: API Key\n`);
      console.log('Response:');
      console.log('─'.repeat(60));
      console.log(text);
      console.log('─'.repeat(60));
      console.log('\n📊 Token Usage:');
      console.log(`   Input: ${usage?.promptTokenCount || 0}`);
      console.log(`   Output: ${usage?.candidatesTokenCount || 0}`);
      console.log(`   Total: ${usage?.totalTokenCount || 0}\n`);
      return;
      
    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.log('❌ Not found');
      } else if (error.message?.includes('403')) {
        console.log('❌ Permission denied');
      } else if (error.message?.includes('401')) {
        console.log('❌ Unauthorized - invalid API key');
      } else {
        console.log(`❌ ${error.message.substring(0, 50)}`);
      }
    }
  }
  
  console.log('\n❌ No working models found.');
  console.log('\nPossible issues:');
  console.log('1. API key is invalid or expired');
  console.log('2. Generative AI not enabled for your project');
  console.log('3. API key not authorized for Vertex AI');
  console.log(`\nEnable Generative AI: https://console.cloud.google.com/vertex-ai/generative?project=${projectId}`);
}

test();
