/**
 * Test AWS Bedrock with the API key used directly (no decoding)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

dotenv.config();

async function testDirectKey() {
  console.log('='.repeat(60));
  console.log('🧪 AWS Bedrock Direct API Key Test');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.AWS_BEDROCK_API_KEY;
  const region = process.env.AWS_REGION || 'eu-west-2';

  if (!apiKey) {
    console.error('❌ AWS_BEDROCK_API_KEY not set');
    process.exit(1);
  }

  console.log('Testing different credential approaches...');
  console.log('');

  // Approach 1: Use API key directly as both access key and secret
  console.log('Approach 1: Direct API key (both fields)');
  try {
    const client1 = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: apiKey,
        secretAccessKey: apiKey,
      },
    });

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client1.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    console.log('  ✅ SUCCESS with direct API key');
    console.log('  Response received:', body.content?.[0]?.text?.substring(0, 50) || 'OK');
    process.exit(0);
  } catch (error: any) {
    console.log('  ❌ Failed:', error.message);
    console.log('  Status:', error.$metadata?.httpStatusCode);
  }
  console.log('');

  // Approach 2: Try with default credentials (environment variables)
  console.log('Approach 2: Default AWS credentials');
  try {
    const client2 = new BedrockRuntimeClient({
      region,
    });

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client2.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    console.log('  ✅ SUCCESS with default credentials');
    console.log('  Response received:', body.content?.[0]?.text?.substring(0, 50) || 'OK');
    process.exit(0);
  } catch (error: any) {
    console.log('  ❌ Failed:', error.message);
    console.log('  Status:', error.$metadata?.httpStatusCode);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('❌ All approaches failed');
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 The AWS Bedrock API key format may not be standard.');
  console.log('');
  console.log('Possible solutions:');
  console.log('  1. Check if you need to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  console.log('     separately instead of using AWS_BEDROCK_API_KEY');
  console.log('');
  console.log('  2. Verify the API key is correct in the AWS Bedrock console');
  console.log('');
  console.log('  3. Ensure models are enabled:');
  console.log('     - Go to: https://console.aws.amazon.com/bedrock/');
  console.log('     - Click "Model access" in the left sidebar');
  console.log('     - Enable "Claude Sonnet 4.5" and "DeepSeek V3"');
  console.log('');
  console.log('  4. Check if your AWS account has Bedrock access in eu-west-2');
  console.log('');

  process.exit(1);
}

testDirectKey();
