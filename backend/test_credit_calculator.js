const {
  calculateTextGenerationCredits,
  calculateRAGQuestionCredits,
  calculateEnhanceCredits,
  calculateVideoIngestionCredits,
  calculateURLConversionCredits,
  calculatePDFConversionCredits,
  calculateCredits,
  estimateTextGenerationCredits,
  getModelMultiplier
} = require('./dist/utils/creditCalculator');

console.log('=== Credit Calculator Validation ===\n');

let passed = 0;
let failed = 0;

function test(description, actual, expected) {
  if (actual === expected) {
    console.log(`✅ ${description}: ${actual} credits (expected ${expected})`);
    passed++;
  } else {
    console.log(`❌ ${description}: ${actual} credits (expected ${expected})`);
    failed++;
  }
}

console.log('--- Text Generation Credits ---');
test('50k tokens (gpt-4)', calculateTextGenerationCredits(25000, 25000, 'gpt-4'), 1);
test('200k tokens (gpt-4)', calculateTextGenerationCredits(100000, 100000, 'gpt-4'), 1);
test('250k tokens (gpt-4)', calculateTextGenerationCredits(125000, 125000, 'gpt-4'), 2);
test('400k tokens (gpt-4)', calculateTextGenerationCredits(200000, 200000, 'gpt-4'), 2);
test('500k tokens (gpt-4)', calculateTextGenerationCredits(250000, 250000, 'gpt-4'), 3);
test('1 token minimum (gpt-4)', calculateTextGenerationCredits(1, 0, 'gpt-4'), 1);

console.log('\n--- Model Multipliers ---');
test('50k tokens (gpt-5.2, 2x)', calculateTextGenerationCredits(25000, 25000, 'gpt-5.2'), 2);
test('250k tokens (gpt-5.2, 2x)', calculateTextGenerationCredits(125000, 125000, 'gpt-5.2'), 4);
test('50k tokens (claude-sonnet-4.5, 2x)', calculateTextGenerationCredits(25000, 25000, 'claude-sonnet-4.5'), 2);
test('250k tokens (claude-sonnet-4.5, 2x)', calculateTextGenerationCredits(125000, 125000, 'claude-sonnet-4.5'), 4);
test('50k tokens (claude-opus-4.5, 5x)', calculateTextGenerationCredits(25000, 25000, 'claude-opus-4.5'), 5);
test('250k tokens (claude-opus-4.5, 5x)', calculateTextGenerationCredits(125000, 125000, 'claude-opus-4.5'), 10);

console.log('\n--- RAG Question Credits ---');
test('RAG question (gpt-4)', calculateRAGQuestionCredits('gpt-4'), 1);
test('RAG question (gpt-5.2, 2x)', calculateRAGQuestionCredits('gpt-5.2'), 2);
test('RAG question (claude-opus-4.5, 5x)', calculateRAGQuestionCredits('claude-opus-4.5'), 5);

console.log('\n--- Enhance Credits ---');
test('Enhance (gpt-4)', calculateEnhanceCredits('gpt-4'), 1);
test('Enhance (gpt-5.2, 2x)', calculateEnhanceCredits('gpt-5.2'), 2);
test('Enhance (claude-opus-4.5, 5x)', calculateEnhanceCredits('claude-opus-4.5'), 5);

console.log('\n--- Video Ingestion Credits ---');
test('Video 2 minutes', calculateVideoIngestionCredits(2), 1);
test('Video 5 minutes', calculateVideoIngestionCredits(5), 1);
test('Video 6 minutes', calculateVideoIngestionCredits(6), 2);
test('Video 15 minutes', calculateVideoIngestionCredits(15), 3);
test('Video 20 minutes', calculateVideoIngestionCredits(20), 4);
test('Video 25 minutes', calculateVideoIngestionCredits(25), 5);

console.log('\n--- Flat Rate Operations ---');
test('URL conversion', calculateURLConversionCredits(), 1);
test('PDF conversion', calculatePDFConversionCredits(), 1);

console.log('\n--- Universal Calculator ---');
test('Universal: text_generation', calculateCredits('text_generation', {
  inputTokens: 125000,
  outputTokens: 125000,
  model: 'gpt-4'
}), 2);
test('Universal: rag_question', calculateCredits('rag_question', { model: 'gpt-4' }), 1);
test('Universal: enhance', calculateCredits('enhance', { model: 'gpt-5.2' }), 2);
test('Universal: video_ingestion', calculateCredits('video_ingestion', { durationMinutes: 15 }), 3);
test('Universal: url_conversion', calculateCredits('url_conversion', {}), 1);
test('Universal: pdf_conversion', calculateCredits('pdf_conversion', {}), 1);

console.log('\n--- Model Multiplier Lookup ---');
test('Multiplier: gpt-4', getModelMultiplier('gpt-4'), 1);
test('Multiplier: gpt-5.2', getModelMultiplier('gpt-5.2'), 2);
test('Multiplier: claude-sonnet-4.5', getModelMultiplier('claude-sonnet-4.5'), 2);
test('Multiplier: claude-opus-4.5', getModelMultiplier('claude-opus-4.5'), 5);

console.log('\n--- Estimate Function ---');
test('Estimate 250k tokens', estimateTextGenerationCredits(125000, 125000, 'gpt-4'), 2);

console.log('\n=== Test Summary ===');
console.log(`Total: ${passed + failed} tests`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All validations passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some validations failed!');
  process.exit(1);
}
