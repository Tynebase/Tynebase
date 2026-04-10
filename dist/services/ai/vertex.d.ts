/**
 * Vertex AI Integration Service
 * Handles video/audio transcription using Google's Gemini models via Vertex AI (europe-west2)
 *
 * Features:
 * - Video transcription with timestamps
 * - Audio transcription support
 * - 60-second timeout
 * - Token counting for billing
 * - EU data residency compliance (London region)
 *
 * Supported Models:
 * - gemini-2.5-flash (optimized for video/audio processing)
 */
import { AIGenerationRequest, AIGenerationResponse } from './types';
/**
 * Transcribes audio content using Gemini 2.5 Flash (europe-west1)
 * Optimized for audio files uploaded to GCS
 *
 * @param audioGcsUri - GCS URI to audio file (gs://bucket/path)
 * @param prompt - Optional prompt to guide transcription
 * @returns Transcription text with timestamps
 * @throws Error on API failures or timeout
 */
export declare function transcribeAudio(audioGcsUri: string, prompt?: string): Promise<AIGenerationResponse>;
/**
 * Transcribes video content using Gemini 3 Pro model (global endpoint)
 * Uses gemini-3-pro on global endpoint for higher token limits
 *
 * @param videoUrl - Public URL, YouTube URL, or GCS path to video file
 * @param prompt - Optional prompt to guide transcription (e.g., "Transcribe this video with timestamps")
 * @returns Transcription text with timestamps
 * @throws Error on API failures or timeout
 */
export declare function transcribeVideo(videoUrl: string, prompt?: string): Promise<AIGenerationResponse>;
/**
 * Generates text using Gemini model (for general purpose use)
 * Note: Primarily used for video/audio, but can handle text generation
 *
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
export declare function generateText(request: AIGenerationRequest): Promise<AIGenerationResponse>;
/**
 * Generates text with streaming using Gemini model
 *
 * @param request - Generation request parameters
 * @returns Async generator yielding text chunks and final response
 * @throws Error on API failures or timeout
 */
export declare function generateTextStream(request: AIGenerationRequest): AsyncGenerator<string, AIGenerationResponse, undefined>;
//# sourceMappingURL=vertex.d.ts.map