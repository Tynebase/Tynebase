/**
 * Raw AWS Bedrock API test with minimal payload
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

dotenv.config();

async function testRawBedrock() {
  console.log('='.repeat(60));
  console.log('🧪 Raw AWS Bedrock API Test');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.AWS_BEDROCK_API_KEY;
  const region = process.env.AWS_REGION || 'eu-west-2';

  if (!apiKey) {
    console.error('❌ AWS_BEDROCK_API_KEY not set');
    process.exit(1);
  }

  try {
    // Decode API key
    console.log('Step 1: Decode API Key');
    const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    
    const accessKeyId = parts[0];
    const secretAccessKey = parts.slice(1).join(':');
    
    console.log('  Access Key ID:', accessKeyId.substring(0, 30) + '...');
    console.log('  Secret Key:', secretAccessKey.substring(0, 20) + '...');
    console.log('  Region:', region);
    console.log('');

    // Initialize client
    console.log('Step 2: Initialize Bedrock Client');
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    console.log('  ✅ Client initialized');
    console.log('');

    // Test with Claude first (more likely to be enabled)
    console.log('Step 3: Test Claude Sonnet 4.5');
    const claudePayload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: 'Write a haiku about AI.',
        },
      ],
    };

    const claudeCommand = new InvokeModelCommand({
      modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(claudePayload),
    });

    console.log('  Calling Claude...');
    const claudeResponse = await client.send(claudeCommand);
    const claudeBody = JSON.parse(new TextDecoder().decode(claudeResponse.body));
    
    console.log('  ✅ Claude API call successful');
    console.log('  Response:', JSON.stringify(claudeBody, null, 2));
    console.log('');

    // Now test DeepSeek
    console.log('Step 4: Test DeepSeek V3');
    const deepseekPayload = {
      messages: [
        {
          role: 'user',
          content: 'Write a haiku about AI.',
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    };

    const deepseekCommand = new InvokeModelCommand({
      modelId: 'deepseek.v3-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(deepseekPayload),
    });

    console.log('  Calling DeepSeek...');
    const deepseekResponse = await client.send(deepseekCommand);
    const deepseekBody = JSON.parse(new TextDecoder().decode(deepseekResponse.body));
    
    console.log('  ✅ DeepSeek API call successful');
    console.log('  Response:', JSON.stringify(deepseekBody, null, 2));
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Test Failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('Error name:', error.name);
    console.error('HTTP Status:', error.$metadata?.httpStatusCode);
    console.error('');
    
    if (error.$metadata?.httpStatusCode === 403) {
      console.error('💡 Model not enabled in AWS Bedrock console');
      console.error('   Go to: https://console.aws.amazon.com/bedrock/');
      console.error('   Enable model access for the model being tested');
    } else if (error.$metadata?.httpStatusCode === 404) {
      console.error('💡 Model not found in region');
      console.error('   Check model ID and region availability');
    }
    
    console.error('');
    console.error('Full error:');
    console.error(error);
    
    process.exit(1);
  }
}

testRawBedrock();
