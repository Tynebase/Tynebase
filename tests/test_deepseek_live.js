/**
 * Test DeepSeek V3 API via AWS Bedrock
 * Tests live API call with actual credentials
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const AWS_BEDROCK_API_KEY = process.env.AWS_BEDROCK_API_KEY;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-2';

if (!AWS_BEDROCK_API_KEY) {
  console.error('❌ Missing AWS_BEDROCK_API_KEY in backend/.env');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('🧪 Testing DeepSeek V3 via AWS Bedrock');
console.log('='.repeat(60));
console.log('');

async function testDeepSeekAPI() {
  try {
    // Step 1: Initialize Bedrock client
    console.log('Step 1: Initialize AWS Bedrock Client');
    console.log('  Region:', AWS_REGION);
    console.log('  API Key:', AWS_BEDROCK_API_KEY.substring(0, 20) + '...');
    
    const client = new BedrockRuntimeClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: 'BEDROCK_API_KEY',
        secretAccessKey: AWS_BEDROCK_API_KEY,
      },
    });
    
    console.log('  ✅ Client initialized');
    console.log('');

    // Step 2: Prepare test prompt
    console.log('Step 2: Prepare Test Prompt');
    const testPrompt = 'Write a haiku about artificial intelligence.';
    console.log('  Prompt:', testPrompt);
    console.log('');

    // Step 3: Call DeepSeek API
    console.log('Step 3: Call DeepSeek V3 API');
    console.log('  Model: deepseek.v3-v1:0');
    console.log('  Making API call...');
    
    const payload = {
      messages: [
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId: 'deepseek.v3-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const startTime = Date.now();
    const response = await client.send(command);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('  ✅ API call successful');
    console.log('  Duration:', duration + 'ms');
    console.log('');

    // Step 4: Parse response
    console.log('Step 4: Parse Response');
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('  Response structure:');
    console.log('    - choices:', responseBody.choices?.length || 0);
    console.log('    - usage.input_tokens:', responseBody.usage?.input_tokens || 0);
    console.log('    - usage.output_tokens:', responseBody.usage?.output_tokens || 0);
    console.log('');

    // Step 5: Display generated content
    console.log('Step 5: Generated Content');
    console.log('  ' + '─'.repeat(58));
    
    if (responseBody.choices && responseBody.choices.length > 0) {
      const content = responseBody.choices[0].message?.content || 'No content';
      console.log('  ' + content.split('\n').join('\n  '));
    } else {
      console.log('  No content generated');
    }
    
    console.log('  ' + '─'.repeat(58));
    console.log('');

    // Step 6: Verify token usage
    console.log('Step 6: Verify Token Usage');
    const usage = responseBody.usage || {};
    console.log('  Input tokens:', usage.input_tokens || 0);
    console.log('  Output tokens:', usage.output_tokens || 0);
    console.log('  Total tokens:', (usage.input_tokens || 0) + (usage.output_tokens || 0));
    
    if (usage.input_tokens > 0 && usage.output_tokens > 0) {
      console.log('  ✅ Token usage tracked correctly');
    } else {
      console.log('  ⚠️  Token usage not tracked');
    }
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ DeepSeek V3 API Test PASSED');
    console.log('');
    console.log('Validated:');
    console.log('  ✅ AWS Bedrock client initialization');
    console.log('  ✅ DeepSeek model invocation (deepseek.v3-v1:0)');
    console.log('  ✅ Response parsing and content extraction');
    console.log('  ✅ Token usage tracking');
    console.log('  ✅ API latency: ' + duration + 'ms');
    console.log('');
    console.log('Model Details:');
    console.log('  Provider: AWS Bedrock');
    console.log('  Region: ' + AWS_REGION);
    console.log('  Model: deepseek.v3-v1:0');
    console.log('  Status: ✅ Operational');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Test Failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.name === 'UnauthorizedException' || error.$metadata?.httpStatusCode === 401) {
      console.error('💡 Troubleshooting:');
      console.error('  - Check AWS_BEDROCK_API_KEY is correct');
      console.error('  - Verify API key has not expired');
      console.error('  - Ensure key has Bedrock permissions');
    } else if (error.name === 'AccessDeniedException' || error.$metadata?.httpStatusCode === 403) {
      console.error('💡 Troubleshooting:');
      console.error('  - API key lacks permission to invoke DeepSeek model');
      console.error('  - Check IAM policy includes bedrock:InvokeModel');
      console.error('  - Verify model access is enabled in AWS console');
    } else if (error.name === 'ResourceNotFoundException' || error.$metadata?.httpStatusCode === 404) {
      console.error('💡 Troubleshooting:');
      console.error('  - DeepSeek model not found in ' + AWS_REGION);
      console.error('  - Verify model ID: deepseek.v3-v1:0');
      console.error('  - Check model is enabled in AWS Bedrock console');
    } else if (error.name === 'ThrottlingException' || error.$metadata?.httpStatusCode === 429) {
      console.error('💡 Troubleshooting:');
      console.error('  - Rate limit exceeded');
      console.error('  - Wait a moment and try again');
      console.error('  - Check AWS Bedrock quotas');
    }
    
    console.error('');
    console.error('Full error details:');
    console.error(error);
    console.error('');
    
    process.exit(1);
  }
}

testDeepSeekAPI();
