/**
 * Test Gemini using Google API Key (Generative Language API)
 * This is different from Vertex AI - uses direct Gemini API
 */

import * as dotenv from 'dotenv';

dotenv.config();

async function testWithAPIKey() {
  console.log('🔍 Testing Gemini with API Key...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_API_KEY not found in .env file');
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);
  
  // Test with Gemini API (not Vertex AI)
  const models = [
    'gemini-3-flash-preview',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
  ];
  
  for (const modelName of models) {
    try {
      process.stdout.write(`Trying ${modelName}... `);
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "Hello from Gemini!" and confirm you are working correctly.'
            }]
          }]
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('❌ Model not found');
        } else if (response.status === 403) {
          console.log('❌ Permission denied');
        } else if (response.status === 400) {
          console.log(`❌ Bad request: ${data.error?.message || 'Unknown error'}`);
        } else {
          console.log(`❌ Error ${response.status}: ${data.error?.message || 'Unknown'}`);
        }
        continue;
      }
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage = data.usageMetadata;
      
      console.log('✅ WORKS!\n');
      console.log('✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log(`Working model: ${modelName}`);
      console.log('API: Generative Language API (direct Gemini API)\n');
      console.log('Response:');
      console.log('─'.repeat(60));
      console.log(text || 'No response text');
      console.log('─'.repeat(60));
      console.log('\n📊 Token Usage:');
      console.log(`   Input: ${usage?.promptTokenCount || 0}`);
      console.log(`   Output: ${usage?.candidatesTokenCount || 0}`);
      console.log(`   Total: ${usage?.totalTokenCount || 0}\n`);
      
      console.log('⚠️  NOTE: This uses the Generative Language API, NOT Vertex AI.');
      console.log('Your backend code uses Vertex AI, which requires different setup.\n');
      return;
      
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
    }
  }
  
  console.log('\n❌ No working models found with this API key.');
}

testWithAPIKey();
