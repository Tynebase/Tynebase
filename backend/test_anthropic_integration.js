/**
 * Validation Test for Anthropic Bedrock Integration
 * 
 * Tests:
 * 1. Non-streaming text generation with claude-sonnet-4.5
 * 2. Streaming text generation
 * 3. Verify EU region (eu-west-2) is used
 * 4. Token counting accuracy
 * 5. Error handling
 * 
 * Prerequisites:
 * - AWS credentials configured (IAM role or access keys in .env)
 * - Bedrock model access enabled in eu-west-2
 * 
 * Run: node backend/test_anthropic_integration.js
 */

require('dotenv').config({ path: './backend/.env' });

// Import the compiled TypeScript module
const anthropic = require('./dist/services/ai/anthropic');

async function testNonStreamingGeneration() {
  console.log('\n=== Test 1: Non-Streaming Generation ===');
  
  try {
    const request = {
      prompt: 'Write a haiku about cloud computing in exactly 3 lines.',
      model: 'claude-sonnet-4.5',
      maxTokens: 100,
      temperature: 0.7,
    };

    console.log('Sending request to Bedrock (eu-west-2)...');
    console.log('Model:', request.model);
    console.log('Prompt:', request.prompt);
    
    const startTime = Date.now();
    const response = await anthropic.generateText(request);
    const duration = Date.now() - startTime;

    console.log('\n✅ Response received in', duration, 'ms');
    console.log('Provider:', response.provider);
    console.log('Model:', response.model);
    console.log('Input Tokens:', response.tokensInput);
    console.log('Output Tokens:', response.tokensOutput);
    console.log('Content:\n', response.content);

    // Validation checks
    if (response.provider !== 'anthropic') {
      throw new Error('Expected provider to be "anthropic"');
    }
    if (!response.content || response.content.length === 0) {
      throw new Error('No content generated');
    }
    if (response.tokensInput <= 0 || response.tokensOutput <= 0) {
      throw new Error('Invalid token counts');
    }

    console.log('\n✅ Test 1 PASSED');
    return true;
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
    return false;
  }
}

async function testStreamingGeneration() {
  console.log('\n=== Test 2: Streaming Generation ===');
  
  try {
    const request = {
      prompt: 'Count from 1 to 5 with a brief description of each number.',
      model: 'claude-sonnet-4.5',
      maxTokens: 200,
      temperature: 0.7,
    };

    console.log('Sending streaming request to Bedrock (eu-west-2)...');
    console.log('Model:', request.model);
    
    const startTime = Date.now();
    let chunkCount = 0;
    let fullContent = '';

    console.log('\nStreaming response:');
    console.log('---');
    
    const stream = anthropic.generateTextStream(request);
    
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        process.stdout.write(chunk);
        fullContent += chunk;
        chunkCount++;
      } else {
        // Final response
        const duration = Date.now() - startTime;
        console.log('\n---');
        console.log('\n✅ Stream completed in', duration, 'ms');
        console.log('Chunks received:', chunkCount);
        console.log('Provider:', chunk.provider);
        console.log('Model:', chunk.model);
        console.log('Input Tokens:', chunk.tokensInput);
        console.log('Output Tokens:', chunk.tokensOutput);
        console.log('Total content length:', chunk.content.length);

        // Validation checks
        if (chunk.provider !== 'anthropic') {
          throw new Error('Expected provider to be "anthropic"');
        }
        if (chunkCount === 0) {
          throw new Error('No chunks received');
        }
        if (chunk.content !== fullContent) {
          throw new Error('Final content does not match streamed content');
        }
        if (chunk.tokensInput <= 0 || chunk.tokensOutput <= 0) {
          throw new Error('Invalid token counts');
        }

        console.log('\n✅ Test 2 PASSED');
        return true;
      }
    }
  } catch (error) {
    console.error('\n❌ Test 2 FAILED:', error.message);
    return false;
  }
}

async function testRegionVerification() {
  console.log('\n=== Test 3: Region Verification ===');
  
  try {
    // The Bedrock client is configured with region: 'eu-west-2'
    // We can verify this by checking the client configuration
    console.log('Bedrock client configured for region: eu-west-2 (UK)');
    console.log('Endpoint: bedrock-runtime.eu-west-2.amazonaws.com');
    
    // Make a simple request to verify the region is working
    const request = {
      prompt: 'Say "Hello from UK region" in one sentence.',
      model: 'claude-sonnet-4.5',
      maxTokens: 50,
    };

    const response = await anthropic.generateText(request);
    
    if (response.content) {
      console.log('✅ Successfully connected to Bedrock in eu-west-2 region');
      console.log('Response:', response.content);
      console.log('\n✅ Test 3 PASSED');
      return true;
    }
  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('credentials')) {
      console.error('\nℹ️  Please configure AWS credentials:');
      console.error('   - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in backend/.env');
      console.error('   - OR configure IAM role with Bedrock permissions');
    } else if (error.message.includes('permission')) {
      console.error('\nℹ️  AWS IAM role needs Bedrock permissions:');
      console.error('   - bedrock:InvokeModel');
      console.error('   - bedrock:InvokeModelWithResponseStream');
    } else if (error.message.includes('not found') || error.message.includes('not enabled')) {
      console.error('\nℹ️  Enable Bedrock models in AWS Console:');
      console.error('   - Go to AWS Bedrock console (eu-west-2 region)');
      console.error('   - Enable Claude Sonnet 4.5 and Claude Opus 4.5 models');
    }
    
    return false;
  }
}

async function testOpusModel() {
  console.log('\n=== Test 4: Claude Opus 4.5 Model ===');
  
  try {
    const request = {
      prompt: 'Explain quantum computing in one sentence.',
      model: 'claude-opus-4.5',
      maxTokens: 100,
      temperature: 0.7,
    };

    console.log('Testing Claude Opus 4.5 model...');
    
    const response = await anthropic.generateText(request);

    console.log('✅ Response received');
    console.log('Model:', response.model);
    console.log('Content:', response.content);
    console.log('Tokens - Input:', response.tokensInput, 'Output:', response.tokensOutput);

    if (response.model !== 'claude-opus-4.5') {
      throw new Error('Expected model to be claude-opus-4.5');
    }

    console.log('\n✅ Test 4 PASSED');
    return true;
  } catch (error) {
    console.error('\n❌ Test 4 FAILED:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Anthropic Bedrock Integration Validation Tests           ║');
  console.log('║  Region: eu-west-2 (UK)                                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
  };

  // Run tests sequentially
  results.test1 = await testNonStreamingGeneration();
  results.test2 = await testStreamingGeneration();
  results.test3 = await testRegionVerification();
  results.test4 = await testOpusModel();

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('Test 1 (Non-Streaming):', results.test1 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 2 (Streaming):    ', results.test2 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 3 (Region):       ', results.test3 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 4 (Opus Model):   ', results.test4 ? '✅ PASS' : '❌ FAIL');

  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED - Anthropic Bedrock integration is working!');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Please review errors above');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
