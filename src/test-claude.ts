/**
 * Quick test for Claude Sonnet 4.5 via AWS Bedrock
 * Run with: tsx src/test-claude.ts
 */

import { generateText } from './services/ai/anthropic';
import dotenv from 'dotenv';

dotenv.config();

async function testClaude() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Claude Sonnet 4.5 via AWS Bedrock');
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

    console.log('Step 3: Call Claude Sonnet 4.5 API');
    console.log('  Model: claude-sonnet-4.5');
    console.log('  Making API call...');
    
    const startTime = Date.now();
    const response = await generateText({
      prompt,
      model: 'claude-sonnet-4.5',
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
    console.log('✅ Claude Sonnet 4.5 API Test PASSED');
    console.log('');
    console.log('Model Status: ✅ Operational');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Test Failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    process.exit(1);
  }
}

testClaude();
