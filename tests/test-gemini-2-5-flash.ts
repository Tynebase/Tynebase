/**
 * Test gemini-2.5-flash in europe-west2
 */

import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🔍 Testing gemini-2.5-flash in europe-west2...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_API_KEY not found in .env');
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 15)}...\n`);
  
  const region = 'europe-west2';
  const modelName = 'gemini-2.5-flash';
  
  try {
    console.log(`Testing: ${modelName} in ${region}...\n`);
    
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
      const errorText = await response.text();
      console.log(`❌ Error ${response.status}`);
      console.log('Response:', errorText.substring(0, 500));
      return;
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
      console.log('❌ Parse error:', e.message);
      return;
    }
    
    console.log('🎉 ✅ ✅ ✅ SUCCESS! ✅ ✅ ✅ 🎉\n');
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
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

test();
