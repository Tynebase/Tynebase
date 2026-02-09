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

import { VertexAI } from '@google-cloud/vertexai';
import { AIGenerationRequest, AIGenerationResponse } from './types';
import { countTokens } from '../../utils/tokenCounter';

/**
 * Vertex AI client configured for EU region (text generation)
 */
let vertexClient: VertexAI | null = null;

/**
 * Model ID for Gemini Flash (text generation)
 */
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Model ID for Gemini video processing (same as text - only flash available on EU endpoint)
 */
const GEMINI_VIDEO_MODEL = 'gemini-2.5-flash';

/**
 * Vertex AI configuration
 */
const VERTEX_CONFIG = {
  project: process.env.GOOGLE_CLOUD_PROJECT || '',
  location: 'europe-west2', // London region for EU data residency
  videoLocation: 'europe-west2', // EU endpoint - gemini-2.5-flash is the only model available
};

/**
 * Parses service account credentials from environment
 * @returns Service account credentials object or null
 */
function getServiceAccountCredentials(): any {
  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!gcpJson) {
    return null;
  }

  try {
    // Check if it's base64 encoded
    const decoded = Buffer.from(gcpJson, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    // If not base64, try parsing as direct JSON
    try {
      return JSON.parse(gcpJson);
    } catch (err) {
      console.error('Failed to parse GCP_SERVICE_ACCOUNT_JSON:', err);
      return null;
    }
  }
}

/**
 * Initializes the Vertex AI client with EU region
 * @throws Error if credentials are not properly configured
 */
function getVertexClient(): VertexAI {
  if (!vertexClient) {
    // Try to get credentials from GCP_SERVICE_ACCOUNT_JSON first
    const credentials = getServiceAccountCredentials();
    let projectId = process.env.GOOGLE_CLOUD_PROJECT;

    if (credentials) {
      // Extract project ID from service account JSON
      projectId = projectId || credentials.project_id;
      
      if (!projectId) {
        throw new Error('Project ID not found in service account credentials or GOOGLE_CLOUD_PROJECT');
      }

      // Initialize with explicit credentials
      vertexClient = new VertexAI({
        project: projectId,
        location: VERTEX_CONFIG.location,
        googleAuthOptions: {
          credentials: credentials,
        },
      });
    } else {
      // Fall back to Application Default Credentials
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set and no service account JSON provided');
      }

      // Initialize Vertex AI client with ADC
      // Authentication uses Application Default Credentials (ADC):
      // 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (service account JSON file path)
      // 2. gcloud auth application-default login (for development)
      // 3. Compute Engine/GKE service account (for production)
      vertexClient = new VertexAI({
        project: projectId,
        location: VERTEX_CONFIG.location,
      });
    }
  }
  return vertexClient;
}

/**
 * Transcribes audio content using Gemini 2.5 Flash (europe-west1)
 * Optimized for audio files uploaded to GCS
 * 
 * @param audioGcsUri - GCS URI to audio file (gs://bucket/path)
 * @param prompt - Optional prompt to guide transcription
 * @returns Transcription text with timestamps
 * @throws Error on API failures or timeout
 */
export async function transcribeAudio(
  audioGcsUri: string,
  prompt: string = 'Transcribe this audio content with timestamps. Include all spoken words and important context.'
): Promise<AIGenerationResponse> {
  // Use europe-west1 with gemini-2.5-flash for audio processing
  const client = getVertexClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
  });

  try {
    // Count input tokens (approximate based on prompt)
    const inputTokens = countTokens(prompt, 'gpt-4');

    // Prepare file data part for audio
    const fileDataPart: any = {
      fileData: {
        fileUri: audioGcsUri,
        mimeType: 'audio/mpeg',
      },
    };

    // Prepare request with audio URI
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
            fileDataPart,
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.2,
      },
    };

    // Call Vertex AI API with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Vertex AI request timed out after 120 seconds')), 120000);
    });

    const responsePromise = model.generateContent(request);
    const result = await Promise.race([responsePromise, timeoutPromise]);

    // Extract content from response
    const response = result.response;
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract token usage if available
    const usageMetadata = response.usageMetadata;
    const actualInputTokens = usageMetadata?.promptTokenCount || inputTokens;
    const outputTokens = usageMetadata?.candidatesTokenCount || countTokens(content, 'gpt-4');

    return {
      content,
      model: 'gemini-2.5-flash',
      tokensInput: actualInputTokens,
      tokensOutput: outputTokens,
      provider: 'vertex',
    };
  } catch (error: any) {
    // Handle quota/rate limiting
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      throw new Error('Vertex AI quota exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
      throw new Error('Vertex AI request timed out after 120 seconds');
    }

    // Handle authentication errors
    if (error?.message?.includes('authentication') || error?.message?.includes('credentials')) {
      throw new Error('Google Cloud credentials are invalid or not configured. Set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth.');
    }

    // Handle permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('forbidden')) {
      throw new Error('Vertex AI permission denied. Ensure service account has Vertex AI User role.');
    }

    // Generic error
    throw new Error(`Vertex AI transcription error: ${error.message || String(error)}`);
  }
}

/**
 * Transcribes video content using Gemini 3 Pro model (global endpoint)
 * Uses gemini-3-pro on global endpoint for higher token limits
 * 
 * @param videoUrl - Public URL, YouTube URL, or GCS path to video file
 * @param prompt - Optional prompt to guide transcription (e.g., "Transcribe this video with timestamps")
 * @returns Transcription text with timestamps
 * @throws Error on API failures or timeout
 */
export async function transcribeVideo(
  videoUrl: string,
  prompt: string = 'Transcribe this video content with timestamps. Include all spoken words and important visual context.'
): Promise<AIGenerationResponse> {
  // Use EU endpoint with gemini-2.5-flash for video processing
  const client = getVertexClient();
  const model = client.getGenerativeModel({
    model: GEMINI_VIDEO_MODEL,
  });

  try {
    // Count input tokens (approximate based on prompt)
    const inputTokens = countTokens(prompt, 'gpt-4');

    // Detect if this is a YouTube URL
    const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)/.test(videoUrl);

    // Prepare file data part
    // Note: Vertex AI requires mimeType even for YouTube URLs
    const fileDataPart: any = {
      fileData: {
        fileUri: videoUrl,
        mimeType: isYouTubeUrl ? 'video/mp4' : 'video/*',
      },
    };

    // Prepare request with video URL
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
            fileDataPart,
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8000, // Transcriptions can be long
        temperature: 0.2, // Lower temperature for more accurate transcription
      },
    };

    // Call Vertex AI API with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Vertex AI request timed out after 60 seconds')), 60000);
    });

    const responsePromise = model.generateContent(request);
    const result = await Promise.race([responsePromise, timeoutPromise]);

    // Extract content from response
    const response = result.response;
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract token usage if available
    const usageMetadata = response.usageMetadata;
    const actualInputTokens = usageMetadata?.promptTokenCount || inputTokens;
    const outputTokens = usageMetadata?.candidatesTokenCount || countTokens(content, 'gpt-4');

    return {
      content,
      model: 'gemini-2.5-flash',
      tokensInput: actualInputTokens,
      tokensOutput: outputTokens,
      provider: 'vertex',
    };
  } catch (error: any) {
    // Handle quota/rate limiting
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      throw new Error('Vertex AI quota exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
      throw new Error('Vertex AI request timed out after 60 seconds');
    }

    // Handle authentication errors
    if (error?.message?.includes('authentication') || error?.message?.includes('credentials')) {
      throw new Error('Google Cloud credentials are invalid or not configured. Set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth.');
    }

    // Handle permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('forbidden')) {
      throw new Error('Service account does not have permission to access Vertex AI');
    }

    // Handle invalid video URL
    if (error?.message?.includes('invalid') || error?.message?.includes('not found')) {
      throw new Error('Video URL is invalid or file not accessible');
    }

    // Generic error
    throw new Error(
      `Vertex AI transcription error: ${error?.message || 'Unknown error'}`
    );
  }
}


/**
 * Generates text using Gemini model (for general purpose use)
 * Note: Primarily used for video/audio, but can handle text generation
 * 
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
export async function generateText(
  request: AIGenerationRequest
): Promise<AIGenerationResponse> {
  const client = getVertexClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
  });

  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    // Count input tokens
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    // Prepare request
    const generationRequest: any = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: request.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (request.systemPrompt) {
      generationRequest.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    // Call Vertex AI API with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Vertex AI request timed out after 60 seconds')), 60000);
    });

    const responsePromise = model.generateContent(generationRequest);
    const result = await Promise.race([responsePromise, timeoutPromise]);

    // Extract content from response
    const response = result.response;
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract token usage if available
    const usageMetadata = response.usageMetadata;
    const actualInputTokens = usageMetadata?.promptTokenCount || inputTokens;
    const outputTokens = usageMetadata?.candidatesTokenCount || countTokens(content, 'gpt-4');

    return {
      content,
      model: 'gemini-2.5-flash',
      tokensInput: actualInputTokens,
      tokensOutput: outputTokens,
      provider: 'vertex',
    };
  } catch (error: any) {
    // Handle quota/rate limiting
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      throw new Error('Vertex AI quota exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
      throw new Error('Vertex AI request timed out after 60 seconds');
    }

    // Handle authentication errors
    if (error?.message?.includes('authentication') || error?.message?.includes('credentials')) {
      throw new Error('Google Cloud credentials are invalid or not configured. Set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth.');
    }

    // Handle permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('forbidden')) {
      throw new Error('Service account does not have permission to access Vertex AI');
    }

    // Generic error
    throw new Error(
      `Vertex AI API error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Generates text with streaming using Gemini model
 * 
 * @param request - Generation request parameters
 * @returns Async generator yielding text chunks and final response
 * @throws Error on API failures or timeout
 */
export async function* generateTextStream(
  request: AIGenerationRequest
): AsyncGenerator<string, AIGenerationResponse, undefined> {
  const client = getVertexClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
  });

  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    const generationRequest: any = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: request.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (request.systemPrompt) {
      generationRequest.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    const streamResult = await model.generateContentStream(generationRequest);

    let fullContent = '';
    let actualInputTokens = inputTokens;
    let actualOutputTokens = 0;

    for await (const chunk of streamResult.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        fullContent += text;
        yield text;
      }

      if (chunk.usageMetadata) {
        actualInputTokens = chunk.usageMetadata.promptTokenCount || actualInputTokens;
        actualOutputTokens = chunk.usageMetadata.candidatesTokenCount || actualOutputTokens;
      }
    }

    if (!actualOutputTokens) {
      actualOutputTokens = countTokens(fullContent, 'gpt-4');
    }

    return {
      content: fullContent,
      model: 'gemini-2.5-flash',
      tokensInput: actualInputTokens,
      tokensOutput: actualOutputTokens,
      provider: 'vertex',
    };
  } catch (error: any) {
    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      throw new Error('Vertex AI quota exceeded. Please try again later.');
    }

    if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
      throw new Error('Vertex AI streaming request timed out');
    }

    if (error?.message?.includes('authentication') || error?.message?.includes('credentials')) {
      throw new Error('Google Cloud credentials are invalid or not configured.');
    }

    if (error?.message?.includes('permission') || error?.message?.includes('forbidden')) {
      throw new Error('Service account does not have permission to access Vertex AI');
    }

    throw new Error(
      `Vertex AI streaming error: ${error?.message || 'Unknown error'}`
    );
  }
}
