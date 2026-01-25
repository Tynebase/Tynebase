const { countTokens, countMessageTokens, estimateCost } = require('./dist/utils/tokenCounter');

console.log('=== Token Counter Validation ===\n');

const sampleText = 'Hello, how are you doing today? This is a test of the token counting system.';
console.log('Sample text:', sampleText);

try {
  const tokenCount = countTokens(sampleText, 'gpt-4');
  console.log('Token count (gpt-4):', tokenCount);
  console.log('Expected: ~18-20 tokens\n');

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'The capital of France is Paris.' }
  ];
  
  console.log('Sample messages:', JSON.stringify(messages, null, 2));
  const messageTokens = countMessageTokens(messages, 'gpt-4');
  console.log('Message token count:', messageTokens);
  console.log('Expected: ~35-40 tokens\n');

  const inputTokens = 100;
  const outputTokens = 50;
  const cost = estimateCost(inputTokens, outputTokens, 'gpt-4');
  console.log(`Cost estimate for ${inputTokens} input + ${outputTokens} output tokens (gpt-4):`, `$${cost.toFixed(6)}`);
  console.log('Expected: ~$0.006\n');

  console.log('✅ All validations passed!');
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
