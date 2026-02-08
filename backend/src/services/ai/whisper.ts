/**
 * AWS SageMaker Whisper Transcription Service
 * Handles audio/video transcription using Whisper Large V3 Turbo via AWS SageMaker (eu-west-2)
 * 
 * Features:
 * - Audio transcription from video files
 * - Fallback mechanism for Gemini failures
 * - Token counting for billing
 * - EU data residency compliance (London region)
 * 
 * Supported Model:
 * - whisper-large-v3-turbo (SageMaker endpoint)
 */

import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { AIGenerationResponse } from './types';
import { countTokens } from '../../utils/tokenCounter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SageMaker Runtime client configured for EU region
 */
let sageMakerClient: SageMakerRuntimeClient | null = null;

/**
 * Whisper SageMaker endpoint name (extracted from ARN)
 */
const WHISPER_ENDPOINT_ARN = process.env.WHISPER_SAGEMAKER_ENDPOINT || 'arn:aws:sagemaker:eu-west-2:659587467271:endpoint/endpoint-quick-start-utptd';
const WHISPER_ENDPOINT_NAME = WHISPER_ENDPOINT_ARN.split('/').pop() || 'endpoint-quick-start-utptd';

/**
 * Initializes the SageMaker Runtime client with EU region
 * Uses AWS credentials from environment
 * @throws Error if AWS credentials are not configured
 */
function getSageMakerClient(): SageMakerRuntimeClient {
  if (!sageMakerClient) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'eu-west-2';
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables must be set');
    }

    sageMakerClient = new SageMakerRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      maxAttempts: 3,
    });
  }
  return sageMakerClient;
}

/**
 * Transcribes audio from a video file using Whisper via AWS SageMaker
 * 
 * @param audioFilePath - Local path to audio file extracted from video
 * @returns Transcription text
 * @throws Error on API failures or timeout
 */
export async function transcribeAudioWithWhisper(
  audioFilePath: string
): Promise<AIGenerationResponse> {
  const client = getSageMakerClient();

  try {
    // Read audio file as base64
    const audioBuffer = fs.readFileSync(audioFilePath);
    const audioBase64 = audioBuffer.toString('base64');

    // Prepare request payload for Whisper SageMaker endpoint
    const payload = {
      audio_input: audioBase64,
      task: 'transcribe',
      language: 'en', // Auto-detect or specify language
      return_timestamps: true,
    };

    const command = new InvokeEndpointCommand({
      EndpointName: WHISPER_ENDPOINT_NAME,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: JSON.stringify(payload),
    });

    console.log(`[Whisper] Transcribing audio file: ${path.basename(audioFilePath)} using endpoint: ${WHISPER_ENDPOINT_NAME}`);
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.Body));

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
      provider: 'sagemaker',
    };
  } catch (error: any) {
    // Handle throttling/rate limiting
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('Whisper SageMaker rate limit exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('Whisper SageMaker request timed out');
    }

    // Handle authentication errors
    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS SageMaker API credentials are invalid or expired');
    }

    // Handle permission errors
    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS SageMaker API credentials do not have permission to invoke Whisper endpoint');
    }

    // Handle endpoint not found
    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error(`Whisper SageMaker endpoint not found: ${WHISPER_ENDPOINT_NAME}`);
    }

    // Handle validation errors
    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid request to Whisper SageMaker: ${error?.message || 'Unknown validation error'}`);
    }

    // Generic error
    throw new Error(
      `Whisper SageMaker transcription error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Extracts audio from video file using ffmpeg-static (bundled ffmpeg)
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
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  
  // Use bundled ffmpeg-static instead of system ffmpeg
  const ffmpegPath = require('ffmpeg-static');

  try {
    // Use ffmpeg to extract audio as WAV format (best for Whisper)
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y', // Overwrite output file if exists
      outputPath
    ];
    
    console.log(`[Audio Extraction] Extracting audio from video: ${path.basename(videoPath)}`);
    console.log(`[Audio Extraction] Using ffmpeg at: ${ffmpegPath}`);
    
    await execFileAsync(ffmpegPath, args);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('Audio file was not created');
    }

    console.log(`[Audio Extraction] Audio extracted successfully: ${path.basename(outputPath)}`);
    
    return outputPath;
  } catch (error: any) {
    throw new Error(`Failed to extract audio from video: ${error?.message || 'Unknown error'}`);
  }
}
