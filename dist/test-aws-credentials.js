"use strict";
/**
 * Test AWS Bedrock with standard AWS credentials
 * This will test if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY work
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function testAWSCredentials() {
    console.log('='.repeat(60));
    console.log('🧪 AWS Bedrock Test with Standard Credentials');
    console.log('='.repeat(60));
    console.log('');
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'eu-west-2';
    console.log('Configuration Check:');
    console.log('  AWS_ACCESS_KEY_ID:', accessKeyId ? '✅ Set (' + accessKeyId.substring(0, 8) + '...)' : '❌ Missing');
    console.log('  AWS_SECRET_ACCESS_KEY:', secretAccessKey ? '✅ Set (' + secretAccessKey.substring(0, 8) + '...)' : '❌ Missing');
    console.log('  AWS_REGION:', region);
    console.log('');
    if (!accessKeyId || !secretAccessKey) {
        console.error('❌ Missing AWS credentials');
        console.error('');
        console.error('Please update your backend/.env file with:');
        console.error('');
        console.error('AWS_ACCESS_KEY_ID=your-access-key-id');
        console.error('AWS_SECRET_ACCESS_KEY=your-secret-access-key');
        console.error('AWS_REGION=eu-west-2');
        console.error('');
        console.error('Get credentials from: https://console.aws.amazon.com/iam/');
        process.exit(1);
    }
    try {
        console.log('Step 1: Initialize Bedrock Client');
        const client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        console.log('  ✅ Client initialized');
        console.log('');
        // Test DeepSeek V3 (primary model)
        console.log('Step 2: Test DeepSeek V3');
        const deepseekPayload = {
            messages: [
                {
                    role: 'user',
                    content: 'Write a haiku about artificial intelligence.',
                },
            ],
            max_tokens: 100,
            temperature: 0.7,
        };
        const deepseekCommand = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: 'deepseek.v3-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(deepseekPayload),
        });
        console.log('  Calling DeepSeek API...');
        const startDeepSeek = Date.now();
        const deepseekResponse = await client.send(deepseekCommand);
        const deepseekDuration = Date.now() - startDeepSeek;
        const deepseekBody = JSON.parse(new TextDecoder().decode(deepseekResponse.body));
        console.log('  ✅ DeepSeek API call successful');
        console.log('  Duration:', deepseekDuration + 'ms');
        console.log('  Response:');
        console.log('  ' + '─'.repeat(58));
        const deepseekContent = deepseekBody.choices?.[0]?.message?.content || deepseekBody.content || 'No content';
        console.log('  ' + deepseekContent);
        console.log('  ' + '─'.repeat(58));
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log('');
        console.log('✅ TEST PASSED');
        console.log('');
        console.log('Results:');
        console.log('  ✅ DeepSeek V3: ' + deepseekDuration + 'ms');
        console.log('');
        console.log('DeepSeek V3 is operational and accessible!');
        console.log('');
        console.log('Note: Claude requires inference profile configuration.');
        console.log('DeepSeek is the primary model and works perfectly.');
        console.log('');
        process.exit(0);
    }
    catch (error) {
        console.error('');
        console.error('❌ Test Failed');
        console.error('='.repeat(60));
        console.error('');
        console.error('Error:', error.message);
        console.error('Error name:', error.name);
        console.error('HTTP Status:', error.$metadata?.httpStatusCode);
        console.error('');
        if (error.$metadata?.httpStatusCode === 403) {
            console.error('💡 Access Denied - Possible causes:');
            console.error('  1. Model not enabled in AWS Bedrock console');
            console.error('     Go to: https://console.aws.amazon.com/bedrock/');
            console.error('     Click "Model access" → Enable the model');
            console.error('');
            console.error('  2. IAM credentials lack bedrock:InvokeModel permission');
            console.error('     Attach policy: AmazonBedrockFullAccess');
            console.error('');
            console.error('  3. Model not available in region: ' + region);
        }
        else if (error.$metadata?.httpStatusCode === 401) {
            console.error('💡 Invalid credentials');
            console.error('  Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
        }
        else if (error.$metadata?.httpStatusCode === 404) {
            console.error('💡 Model not found');
            console.error('  Check model ID and region availability');
        }
        console.error('');
        console.error('Full error:');
        console.error(error);
        console.error('');
        process.exit(1);
    }
}
testAWSCredentials();
//# sourceMappingURL=test-aws-credentials.js.map