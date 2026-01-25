/**
 * OpenAI Integration Service
 * Handles text generation using OpenAI's EU endpoint (api.eu.openai.com)
 * 
 * Features:
 * - Streaming support for real-time responses
 * - Automatic retry on rate limits (429)
 * - 30-second timeout
 * - Token counting for billing
 * - EU data residency compliance
 */

import OpenAI from 'openai';
import { AIGenerationRequest, AIGenerationResponse } from './types';
import { countTokens } from '../../utils/tokenCounter';

/**
 * OpenAI client configured for EU endpoint
 */
let openaiClient: OpenAI | null = null;

/**
 * Initializes the OpenAI client with EU endpoint
 * @throws Error if OPENAI_API_KEY is not set
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.eu.openai.com/v1',
      timeout: 30000, // 30 second timeout
      maxRetries: 3, // Retry on transient failures
    });
  }
  return openaiClient;
}

/**
 * Generates text using OpenAI's GPT models
 * 
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
export async function generateText(
  request: AIGenerationRequest
): Promise<AIGenerationResponse> {
  const client = getOpenAIClient();
  const model = request.model || 'gpt-5.2';
  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    // Count input tokens
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    // Call OpenAI API (non-streaming)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content || '';
    const outputTokens = completion.usage?.completion_tokens || countTokens(content, 'gpt-4');

    return {
      content,
      model,
      tokensInput: completion.usage?.prompt_tokens || inputTokens,
      tokensOutput: outputTokens,
      provider: 'openai',
    };
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
      throw new Error('OpenAI request timed out after 30 seconds');
    }

    // Handle authentication errors
    if (error?.status === 401) {
      throw new Error('OpenAI API key is invalid or expired');
    }

    // Generic error
    throw new Error(
      `OpenAI API error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Generates text with streaming support
 * Returns an async generator that yields content chunks
 * 
 * @param request - Generation request parameters
 * @returns Async generator yielding text chunks and final response
 */
export async function* generateTextStream(
  request: AIGenerationRequest
): AsyncGenerator<string, AIGenerationResponse, undefined> {
  const client = getOpenAIClient();
  const model = request.model || 'gpt-5.2';
  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    // Count input tokens
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    // Call OpenAI API with streaming
    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    let fullContent = '';

    // Stream chunks to caller
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        yield delta;
      }
    }

    // Count output tokens
    const outputTokens = countTokens(fullContent, 'gpt-4');

    // Return final response
    return {
      content: fullContent,
      model,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      provider: 'openai',
    };
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }

    // Handle timeout
    if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
      throw new Error('OpenAI request timed out after 30 seconds');
    }

    // Handle authentication errors
    if (error?.status === 401) {
      throw new Error('OpenAI API key is invalid or expired');
    }

    // Generic error
    throw new Error(
      `OpenAI API streaming error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Generates embeddings for text using OpenAI's embedding model
 * Used for RAG (Retrieval-Augmented Generation) pipeline
 * 
 * @param text - Text to embed
 * @param model - Embedding model (default: text-embedding-3-large)
 * @returns Array of embedding values (3072 dimensions)
 */
export async function generateEmbedding(
  text: string,
  model: string = 'text-embedding-3-large'
): Promise<number[]> {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model,
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 429) {
      throw new Error('OpenAI rate limit exceeded for embeddings. Please try again later.');
    }

    // Handle authentication errors
    if (error?.status === 401) {
      throw new Error('OpenAI API key is invalid or expired');
    }

    // Generic error
    throw new Error(
      `OpenAI embedding error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Batch generates embeddings for multiple texts
 * More efficient than calling generateEmbedding multiple times
 * 
 * @param texts - Array of texts to embed (max 100)
 * @param model - Embedding model (default: text-embedding-3-large)
 * @returns Array of embedding arrays
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  model: string = 'text-embedding-3-large'
): Promise<number[][]> {
  const client = getOpenAIClient();

  if (texts.length > 100) {
    throw new Error('Maximum 100 texts allowed per batch');
  }

  try {
    const response = await client.embeddings.create({
      model,
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map(item => item.embedding);
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 429) {
      throw new Error('OpenAI rate limit exceeded for batch embeddings. Please try again later.');
    }

    // Handle authentication errors
    if (error?.status === 401) {
      throw new Error('OpenAI API key is invalid or expired');
    }

    // Generic error
    throw new Error(
      `OpenAI batch embedding error: ${error?.message || 'Unknown error'}`
    );
  }
}
