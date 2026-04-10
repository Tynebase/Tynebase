"use strict";
/**
 * Quick test for DeepSeek V3 API via AWS Bedrock
 * Run with: tsx src/test-deepseek.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bedrock_1 = require("./services/ai/bedrock");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function testDeepSeek() {
    console.log('='.repeat(60));
    console.log('🧪 Testing DeepSeek V3 via AWS Bedrock');
    console.log('='.repeat(60));
    console.log('');
    try {
        console.log('Step 1: Check Configuration');
        console.log('  AWS Region:', process.env.AWS_REGION || 'eu-west-2');
        console.log('  API Key:', process.env.AWS_BEDROCK_API_KEY ? '✅ Set' : '❌ Missing');
        console.log('');
        if (!process.env.AWS_BEDROCK_API_KEY) {
            throw new Error('AWS_BEDROCK_API_KEY not set in .env');
        }
        console.log('Step 2: Prepare Test Prompt');
        const prompt = 'Write a haiku about artificial intelligence.';
        console.log('  Prompt:', prompt);
        console.log('');
        console.log('Step 3: Call DeepSeek V3 API');
        console.log('  Model: deepseek-v3 (deepseek.v3-v1:0)');
        console.log('  Making API call...');
        const startTime = Date.now();
        const response = await (0, bedrock_1.generateText)({
            prompt,
            model: 'deepseek-v3',
            maxTokens: 200,
            temperature: 0.7,
        });
        const duration = Date.now() - startTime;
        console.log('  ✅ API call successful');
        console.log('  Duration:', duration + 'ms');
        console.log('');
        console.log('Step 4: Response Details');
        console.log('  Model:', response.model);
        console.log('  Provider:', response.provider);
        console.log('  Input tokens:', response.tokensInput);
        console.log('  Output tokens:', response.tokensOutput);
        console.log('  Total tokens:', response.tokensInput + response.tokensOutput);
        console.log('');
        console.log('Step 5: Generated Content');
        console.log('  ' + '─'.repeat(58));
        console.log('  ' + response.content.split('\n').join('\n  '));
        console.log('  ' + '─'.repeat(58));
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log('');
        console.log('✅ DeepSeek V3 API Test PASSED');
        console.log('');
        console.log('Validated:');
        console.log('  ✅ AWS Bedrock client initialization');
        console.log('  ✅ DeepSeek model invocation');
        console.log('  ✅ Response parsing and content extraction');
        console.log('  ✅ Token usage tracking');
        console.log('  ✅ API latency: ' + duration + 'ms');
        console.log('');
        console.log('Model Status: ✅ Operational');
        console.log('');
        process.exit(0);
    }
    catch (error) {
        console.error('');
        console.error('❌ Test Failed');
        console.error('='.repeat(60));
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        if (error.message.includes('UnauthorizedException') || error.message.includes('401')) {
            console.error('💡 Troubleshooting:');
            console.error('  - Check AWS_BEDROCK_API_KEY is correct');
            console.error('  - Verify API key has not expired');
            console.error('  - Ensure key has Bedrock permissions');
        }
        else if (error.message.includes('AccessDeniedException') || error.message.includes('403')) {
            console.error('💡 Troubleshooting:');
            console.error('  - API key lacks permission to invoke DeepSeek model');
            console.error('  - Check IAM policy includes bedrock:InvokeModel');
            console.error('  - Verify model access is enabled in AWS console');
        }
        else if (error.message.includes('ResourceNotFoundException') || error.message.includes('404')) {
            console.error('💡 Troubleshooting:');
            console.error('  - DeepSeek model not found in region');
            console.error('  - Verify model ID: deepseek.v3-v1:0');
            console.error('  - Check model is enabled in AWS Bedrock console');
        }
        else if (error.message.includes('ThrottlingException') || error.message.includes('429')) {
            console.error('💡 Troubleshooting:');
            console.error('  - Rate limit exceeded');
            console.error('  - Wait a moment and try again');
        }
        console.error('');
        console.error('Full error:');
        console.error(error);
        console.error('');
        process.exit(1);
    }
}
testDeepSeek();
//# sourceMappingURL=test-deepseek.js.map