/**
 * Validation Test for AI Provider Router
 * Tests routing logic with different tenant settings and capabilities
 */

const { routeToProvider, getAvailableModels, supportsCapability, getProviderForModel } = require('./dist/services/ai/router');

console.log('='.repeat(60));
console.log('AI Provider Router Validation Tests');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(array, value, message) {
  if (!array.includes(value)) {
    throw new Error(`${message}\n   Array: ${JSON.stringify(array)}\n   Missing: ${value}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(`${message} - Expected function to throw but it didn't`);
  } catch (error) {
    if (error.message.includes('Expected function to throw')) {
      throw error;
    }
  }
}

console.log('\n--- Test 1: Default Provider (No Settings) ---');
test('Should use OpenAI gpt-5.2 by default for text generation', () => {
  const config = routeToProvider(null, 'text-generation');
  assertEqual(config.provider, 'openai', 'Provider should be openai');
  assertEqual(config.model, 'gpt-5.2', 'Model should be gpt-5.2');
  assertEqual(config.endpoint, 'https://api.eu.openai.com', 'Endpoint should be EU OpenAI');
  assertEqual(config.region, 'eu-west-1', 'Region should be eu-west-1');
});

console.log('\n--- Test 2: Tenant Specifies OpenAI ---');
test('Should route to OpenAI when tenant specifies openai provider', () => {
  const config = routeToProvider({ ai_provider: 'openai' }, 'text-generation');
  assertEqual(config.provider, 'openai', 'Provider should be openai');
  assertEqual(config.model, 'gpt-5.2', 'Model should be gpt-5.2');
});

console.log('\n--- Test 3: Tenant Specifies Anthropic ---');
test('Should route to Anthropic Bedrock when tenant specifies anthropic provider', () => {
  const config = routeToProvider({ ai_provider: 'anthropic' }, 'text-generation');
  assertEqual(config.provider, 'anthropic', 'Provider should be anthropic');
  assertIncludes(['claude-sonnet-4.5', 'claude-opus-4.5'], config.model, 'Model should be Claude');
  assertEqual(config.endpoint, 'bedrock-runtime.eu-west-2.amazonaws.com', 'Endpoint should be Bedrock UK');
  assertEqual(config.region, 'eu-west-2', 'Region should be eu-west-2');
});

console.log('\n--- Test 4: Specific Model Request ---');
test('Should route to correct provider when specific model requested (claude-opus-4.5)', () => {
  const config = routeToProvider({}, 'text-generation', 'claude-opus-4.5');
  assertEqual(config.provider, 'anthropic', 'Provider should be anthropic');
  assertEqual(config.model, 'claude-opus-4.5', 'Model should be claude-opus-4.5');
});

test('Should route to correct provider when specific model requested (gpt-5.2)', () => {
  const config = routeToProvider({}, 'text-generation', 'gpt-5.2');
  assertEqual(config.provider, 'openai', 'Provider should be openai');
  assertEqual(config.model, 'gpt-5.2', 'Model should be gpt-5.2');
});

console.log('\n--- Test 5: Video Transcription (Always Vertex) ---');
test('Should always use Vertex AI for video transcription regardless of tenant settings', () => {
  const config = routeToProvider({ ai_provider: 'openai' }, 'video-transcription');
  assertEqual(config.provider, 'vertex', 'Provider should be vertex for video');
  assertEqual(config.model, 'gemini-3-flash', 'Model should be gemini-3-flash');
  assertEqual(config.endpoint, 'https://europe-west2-aiplatform.googleapis.com', 'Endpoint should be Vertex London');
  assertEqual(config.region, 'europe-west2', 'Region should be europe-west2');
});

test('Should always use Vertex AI for audio transcription', () => {
  const config = routeToProvider({ ai_provider: 'anthropic' }, 'audio-transcription');
  assertEqual(config.provider, 'vertex', 'Provider should be vertex for audio');
  assertEqual(config.model, 'gemini-3-flash', 'Model should be gemini-3-flash');
});

console.log('\n--- Test 6: Invalid Provider Handling ---');
test('Should throw error for invalid provider name', () => {
  assertThrows(
    () => routeToProvider({ ai_provider: 'invalid-provider' }, 'text-generation'),
    'Should throw error for invalid provider'
  );
});

console.log('\n--- Test 7: Invalid Model Handling ---');
test('Should throw error for non-existent model', () => {
  assertThrows(
    () => routeToProvider({}, 'text-generation', 'non-existent-model'),
    'Should throw error for non-existent model'
  );
});

console.log('\n--- Test 8: Capability Support Validation ---');
test('Should throw error when provider does not support capability', () => {
  assertThrows(
    () => routeToProvider({ ai_provider: 'vertex' }, 'text-generation'),
    'Vertex should not support text-generation'
  );
});

console.log('\n--- Test 9: Get Available Models ---');
test('Should return all models supporting text-generation', () => {
  const models = getAvailableModels('text-generation');
  assertIncludes(models, 'gpt-5.2', 'Should include gpt-5.2');
  assertIncludes(models, 'claude-sonnet-4.5', 'Should include claude-sonnet-4.5');
  assertIncludes(models, 'claude-opus-4.5', 'Should include claude-opus-4.5');
});

test('Should return models supporting video-transcription', () => {
  const models = getAvailableModels('video-transcription');
  assertIncludes(models, 'gemini-3-flash', 'Should include gemini-3-flash');
});

console.log('\n--- Test 10: Capability Support Check ---');
test('Should correctly identify OpenAI supports text-generation', () => {
  const supports = supportsCapability('openai', 'text-generation');
  assertEqual(supports, true, 'OpenAI should support text-generation');
});

test('Should correctly identify Vertex does not support text-generation', () => {
  const supports = supportsCapability('vertex', 'text-generation');
  assertEqual(supports, false, 'Vertex should not support text-generation');
});

test('Should correctly identify Vertex supports video-transcription', () => {
  const supports = supportsCapability('vertex', 'video-transcription');
  assertEqual(supports, true, 'Vertex should support video-transcription');
});

console.log('\n--- Test 11: Get Provider for Model ---');
test('Should return correct provider config for gpt-5.2', () => {
  const config = getProviderForModel('gpt-5.2');
  assertEqual(config.provider, 'openai', 'Provider should be openai');
  assertEqual(config.model, 'gpt-5.2', 'Model should be gpt-5.2');
});

test('Should return correct provider config for claude-sonnet-4.5', () => {
  const config = getProviderForModel('claude-sonnet-4.5');
  assertEqual(config.provider, 'anthropic', 'Provider should be anthropic');
  assertEqual(config.model, 'claude-sonnet-4.5', 'Model should be claude-sonnet-4.5');
});

test('Should throw error for unknown model', () => {
  assertThrows(
    () => getProviderForModel('unknown-model'),
    'Should throw error for unknown model'
  );
});

console.log('\n' + '='.repeat(60));
console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(60));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All tests passed! AI Provider Router is working correctly.\n');
  process.exit(0);
}
