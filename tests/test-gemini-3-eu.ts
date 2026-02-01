/**
 * Test Gemini 3 Flash Preview in EU regions with API key
 */

import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🔍 Testing gemini-3-flash-preview in EU regions...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_API_KEY not found in .env');
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 15)}...\n`);
  
  const modelsToTry = [
    'gemini-3-flash-preview',
  ];
  
  const regionsToTry = [
    'us-central1',
    'us-east4',
    'us-west1',
    'europe-west1',
    'europe-west2',
    'europe-west3',
    'europe-west4',
    'asia-southeast1',
  ];
  
  for (const region of regionsToTry) {
    console.log(`\nTesting region: ${region}`);
    console.log('─'.repeat(60));
    
    for (const modelName of modelsToTry) {
      try {
        process.stdout.write(`  ${modelName.padEnd(30)} ... `);
        
        const url = `https://${region}-aiplatform.googleapis.com/v1/projects/tynebase-ai/locations/${region}/publishers/google/models/${modelName}:streamGenerateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: 'Say "Hello from Gemini!" and confirm you are working correctly.'
              }]
            }]
          })
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('❌ Not found');
          } else if (response.status === 403) {
            console.log('❌ Permission denied');
          } else if (response.status === 401) {
            console.log('❌ Unauthorized');
          } else {
            console.log(`❌ Error ${response.status}`);
          }
          continue;
        }
        
        const text = await response.text();
        
        let fullText = '';
        let usageMetadata = null;
        
        try {
          const data = JSON.parse(text);
          
          if (Array.isArray(data)) {
            for (const chunk of data) {
              const content = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) fullText += content;
              if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
            }
          } else {
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) fullText = content;
            if (data.usageMetadata) usageMetadata = data.usageMetadata;
          }
        } catch (e: any) {
          console.log('❌ Parse error');
          continue;
        }
        
        console.log('✅ WORKS!\n');
        console.log('\n🎉 ✅ ✅ ✅ SUCCESS! ✅ ✅ ✅ 🎉\n');
        console.log(`Working Configuration:`);
        console.log(`  Region: ${region}`);
        console.log(`  Model: ${modelName}`);
        console.log(`  Endpoint: ${region}-aiplatform.googleapis.com\n`);
        console.log('Response:');
        console.log('─'.repeat(60));
        console.log(fullText);
        console.log('─'.repeat(60));
        
        if (usageMetadata) {
          console.log('\n📊 Token Usage:');
          console.log(`   Input: ${usageMetadata.promptTokenCount || 0}`);
          console.log(`   Output: ${usageMetadata.candidatesTokenCount || 0}`);
          console.log(`   Total: ${usageMetadata.totalTokenCount || 0}`);
        }
        console.log('');
        return;
        
      } catch (error: any) {
        console.log(`❌ ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ No working configuration found in EU regions.');
}

test();
