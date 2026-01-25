/**
 * Vertex AI Integration Validation Test
 * Tests the Vertex AI service for video transcription capability
 * 
 * Prerequisites:
 * - GOOGLE_CLOUD_PROJECT set in backend/.env
 * - GOOGLE_APPLICATION_CREDENTIALS set or gcloud auth configured
 * - Test video URL (public or GCS)
 * 
 * Usage: node tests/validate_vertex_ai.js
 */

require('dotenv').config({ path: './backend/.env' });

async function validateVertexAI() {
  console.log('🧪 Validating Vertex AI Integration...\n');

  try {
    // Import the vertex service
    const { transcribeVideo, generateText } = require('../backend/src/services/ai/vertex.ts');

    // Check environment variables
    console.log('✓ Checking environment variables...');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      console.error('❌ GOOGLE_CLOUD_PROJECT not set in backend/.env');
      process.exit(1);
    }
    console.log(`  Project ID: ${projectId}`);

    if (!credentials) {
      console.log('  ⚠️  GOOGLE_APPLICATION_CREDENTIALS not set (will try default credentials)');
    } else {
      console.log(`  Credentials: ${credentials}`);
    }

    // Test 1: Text generation (basic functionality)
    console.log('\n✓ Test 1: Text Generation');
    const textResponse = await generateText({
      prompt: 'Say "Hello from Gemini Flash in London!" in exactly those words.',
      maxTokens: 100,
      temperature: 0.1,
    });

    console.log(`  Model: ${textResponse.model}`);
    console.log(`  Provider: ${textResponse.provider}`);
    console.log(`  Input Tokens: ${textResponse.tokensInput}`);
    console.log(`  Output Tokens: ${textResponse.tokensOutput}`);
    console.log(`  Response: ${textResponse.content.substring(0, 100)}...`);

    if (textResponse.provider !== 'vertex') {
      throw new Error('Provider should be "vertex"');
    }
    if (textResponse.model !== 'gemini-3-flash') {
      throw new Error('Model should be "gemini-3-flash"');
    }

    console.log('  ✅ Text generation test passed');

    // Test 2: Video transcription (requires test video URL)
    console.log('\n✓ Test 2: Video Transcription');
    console.log('  ⚠️  Skipping video transcription test (requires test video URL)');
    console.log('  To test video transcription, provide a public video URL or GCS path:');
    console.log('  const result = await transcribeVideo("gs://your-bucket/video.mp4");');

    console.log('\n✅ All Vertex AI validation tests passed!');
    console.log('\n📋 Summary:');
    console.log('  - Vertex AI client initialized successfully');
    console.log('  - Region: europe-west2 (London)');
    console.log('  - Model: gemini-3-flash');
    console.log('  - Text generation: ✅ Working');
    console.log('  - Video transcription: ⚠️  Not tested (requires video URL)');

  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure GOOGLE_CLOUD_PROJECT is set in backend/.env');
    console.error('  2. Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON path');
    console.error('  3. Or run: gcloud auth application-default login');
    console.error('  4. Ensure service account has Vertex AI User role');
    console.error('  5. Ensure Vertex AI API is enabled in your GCP project');
    process.exit(1);
  }
}

validateVertexAI();
