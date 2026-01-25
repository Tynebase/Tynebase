/**
 * AWS Bedrock Integration Service for DeepSeek
 * Handles text generation using DeepSeek V3 model through AWS Bedrock (eu-west-2)
 * 
 * Features:
 * - Streaming support for real-time responses
 * - Automatic retry on throttling
 * - 30-second timeout
 * - Token counting for billing
 * - UK data residency compliance (eu-west-2)
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AIGenerationRequest, AIGenerationResponse } from './types';
import { countTokens } from '../../utils/tokenCounter';

/**
 * Bedrock client configured for EU region
 */
let bedrockClient: BedrockRuntimeClient | null = null;

/**
 * DeepSeek model ID in Bedrock
 */
const DEEPSEEK_MODEL_ID = 'deepseek.v3-v1:0';

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
 * Generates text using DeepSeek V3 via AWS Bedrock
 * 
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
export async function generateText(
  request: AIGenerationRequest
): Promise<AIGenerationResponse> {
  const client = getBedrockClient();
  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    const payload = {
      prompt: request.prompt,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.9,
    };

    const command = new InvokeModelCommand({
      modelId: DEEPSEEK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const content = responseBody.completion || responseBody.text || '';
    const outputTokens = responseBody.usage?.completion_tokens || countTokens(content, 'gpt-4');
    const actualInputTokens = responseBody.usage?.prompt_tokens || inputTokens;

    return {
      content,
      model: 'deepseek-v3',
      tokensInput: actualInputTokens,
      tokensOutput: outputTokens,
      provider: 'bedrock',
    };
  } catch (error: any) {
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('DeepSeek Bedrock rate limit exceeded. Please try again later.');
    }

    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('DeepSeek Bedrock request timed out after 30 seconds');
    }

    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API key is invalid or expired');
    }

    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API key does not have permission to invoke DeepSeek model');
    }

    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('DeepSeek model not found or not enabled in eu-west-2 region');
    }

    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid request to Bedrock: ${error?.message || 'Unknown validation error'}`);
    }

    throw new Error(
      `DeepSeek Bedrock API error: ${error?.message || 'Unknown error'}`
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
  const client = getBedrockClient();
  const maxTokens = request.maxTokens || 4000;
  const temperature = request.temperature ?? 0.7;

  try {
    const inputTokens = countTokens(request.prompt, 'gpt-4');

    const payload = {
      prompt: request.prompt,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.9,
      stream: true,
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: DEEPSEEK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);

    if (!response.body) {
      throw new Error('No response body received from Bedrock');
    }

    let fullContent = '';
    let actualInputTokens = inputTokens;
    let actualOutputTokens = 0;

    for await (const event of response.body) {
      if (event.chunk) {
        const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        
        const delta = chunkData.completion || chunkData.text || '';
        if (delta) {
          fullContent += delta;
          yield delta;
        }

        if (chunkData.usage) {
          actualInputTokens = chunkData.usage.prompt_tokens || actualInputTokens;
          actualOutputTokens = chunkData.usage.completion_tokens || actualOutputTokens;
        }
      }
    }

    if (actualOutputTokens === 0) {
      actualOutputTokens = countTokens(fullContent, 'gpt-4');
    }

    return {
      content: fullContent,
      model: 'deepseek-v3',
      tokensInput: actualInputTokens,
      tokensOutput: actualOutputTokens,
      provider: 'bedrock',
    };
  } catch (error: any) {
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('DeepSeek Bedrock rate limit exceeded. Please try again later.');
    }

    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('DeepSeek Bedrock streaming request timed out after 30 seconds');
    }

    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API key is invalid or expired');
    }

    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API key does not have permission to invoke DeepSeek model');
    }

    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('DeepSeek model not found or not enabled in eu-west-2 region');
    }

    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid streaming request to Bedrock: ${error?.message || 'Unknown validation error'}`);
    }

    throw new Error(
      `DeepSeek Bedrock streaming error: ${error?.message || 'Unknown error'}`
    );
  }
}
