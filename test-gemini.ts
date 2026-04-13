/**
 * Quick test for Gemini/Vertex AI connectivity
 */
import { transcribeAudio } from './src/services/ai/vertex';

async function testGemini() {
  console.log('Testing Gemini connectivity...');
  
  try {
    // Test with a simple text prompt first
    const result = await transcribeAudio(
      'gs://cloud-samples-data/speech/audio.raw',
      'Transcribe this audio'
    );
    
    console.log('✓ Gemini connection successful');
    console.log('Content length:', result.content.length);
    console.log('Tokens:', result.tokensInput, 'input,', result.tokensOutput, 'output');
  } catch (error: any) {
    console.error('✗ Gemini connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testGemini();
