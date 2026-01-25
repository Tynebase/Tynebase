/**
 * AWS Bedrock Whisper Transcription Service
 * Handles audio/video transcription using HuggingFace Whisper Large V3 Turbo via AWS Bedrock (eu-west-2)
 * 
 * Features:
 * - Audio transcription from video files
 * - Fallback mechanism for Gemini failures
 * - Token counting for billing
 * - EU data residency compliance (London region)
 * 
 * Supported Model:
 * - huggingface-asr-whisper-large-v3-turbo
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AIGenerationResponse } from './types';
import { countTokens } from '../../utils/tokenCounter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bedrock client configured for EU region
 */
let bedrockClient: BedrockRuntimeClient | null = null;

/**
 * Whisper model ID in Bedrock
 */
const WHISPER_MODEL_ID = 'huggingface-asr-whisper-large-v3-turbo';

/**
 * Initializes the Bedrock client with EU region
 * Uses AWS Bedrock API key from environment
 * @throws Error if AWS credentials are not configured
 */
function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const apiKey = process.env.AWS_BEDROCK_API_KEY;
    const region = process.env.AWS_REGION || 'eu-west-2';
    
    if (!apiKey) {
      throw new Error('AWS_BEDROCK_API_KEY environment variable must be set');
    }

    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: apiKey,
        secretAccessKey: apiKey,
      },
      maxAttempts: 3,
    });
  }
  return bedrockClient;
}

/**
 * Transcribes audio from a video file using Whisper via AWS Bedrock
 * 
 * @param audioFilePath - Local path to audio file extracted from video
 * @returns Transcription text
 * @throws Error on API failures or timeout
 */
export async function transcribeAudioWithWhisper(
  audioFilePath: string
): Promise<AIGenerationResponse> {
  const client = getBedrockClient();

  try {
    // Read audio file as base64
    const audioBuffer = fs.readFileSync(audioFilePath);
    const audioBase64 = audioBuffer.toString('base64');

    // Prepare request payload for Whisper
    const payload = {
      audio: audioBase64,
      task: 'transcribe',
      language: 'en', // Auto-detect or specify language
      return_timestamps: true,
    };

    const command = new InvokeModelCommand({
      modelId: WHISPER_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    console.log(`[Whisper] Transcribing audio file: ${path.basename(audioFilePath)}`);
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract transcript from response
    const transcript = responseBody.text || responseBody.transcription || '';
    
    if (!transcript) {
      throw new Error('No transcript returned from Whisper model');
    }

    // Calculate token counts for billing
    const inputTokens = Math.ceil(audioBuffer.length / 1000); // Approximate based on file size
    const outputTokens = countTokens(transcript, 'gpt-4');

    console.log(`[Whisper] Transcription completed: ${transcript.length} characters`);

    return {
      content: transcript,
      model: 'whisper-large-v3-turbo',
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      provider: 'bedrock',
    };
  } catch (error: any) {
    // Handle throttling/rate limiting
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('Whisper Bedrock rate limit exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('Whisper Bedrock request timed out');
    }

    // Handle authentication errors
    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API credentials are invalid or expired');
    }

    // Handle permission errors
    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API credentials do not have permission to invoke Whisper model');
    }

    // Handle model not found
    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('Whisper model not found or not enabled in eu-west-2 region');
    }

    // Handle validation errors
    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid request to Whisper Bedrock: ${error?.message || 'Unknown validation error'}`);
    }

    // Generic error
    throw new Error(
      `Whisper Bedrock transcription error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Extracts audio from video file using ffmpeg
 * 
 * @param videoPath - Path to video file
 * @param outputPath - Path where audio file should be saved
 * @returns Path to extracted audio file
 * @throws Error if ffmpeg fails
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string
): Promise<string> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    // Use ffmpeg to extract audio as WAV format (best for Whisper)
    const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputPath}"`;
    
    console.log(`[Audio Extraction] Extracting audio from video: ${path.basename(videoPath)}`);
    
    await execAsync(command);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('Audio file was not created');
    }

    console.log(`[Audio Extraction] Audio extracted successfully: ${path.basename(outputPath)}`);
    
    return outputPath;
  } catch (error: any) {
    throw new Error(`Failed to extract audio from video: ${error?.message || 'Unknown error'}`);
  }
}
