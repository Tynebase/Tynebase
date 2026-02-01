/**
 * Test Vertex AI using API key with direct HTTP calls
 * Based on the Vertex AI API quickstart
 */

import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('🔍 Testing Vertex AI with API Key (Direct HTTP)...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_API_KEY not found in .env');
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 15)}...\n`);
  
  const modelsToTry = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];
  
  for (const modelName of modelsToTry) {
    try {
      process.stdout.write(`Trying ${modelName}... `);
      
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelName}:streamGenerateContent?key=${apiKey}`;
      
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
      
      // Read streaming response
      const text = await response.text();
      
      // Parse the streaming response - it's a JSON array wrapped in []
      let fullText = '';
      let usageMetadata = null;
      
      try {
        // Parse as JSON array
        const data = JSON.parse(text);
        
        if (Array.isArray(data)) {
          // Iterate through streaming chunks
          for (const chunk of data) {
            const content = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) fullText += content;
            if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
          }
        } else {
          // Single response object
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) fullText = content;
          if (data.usageMetadata) usageMetadata = data.usageMetadata;
        }
      } catch (e: any) {
        console.log('❌ Failed to parse response:', e.message);
      }
      
      console.log('✅ WORKS!\n');
      console.log('✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log(`Working model: ${modelName}`);
      console.log('API: Vertex AI (aiplatform.googleapis.com)\n');
      console.log('Response:');
      console.log('─'.repeat(60));
      console.log(fullText || 'No response text');
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
  
  console.log('\n❌ No working models found.');
}

test();
