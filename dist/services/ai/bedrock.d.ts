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
import { AIGenerationRequest, AIGenerationResponse } from './types';
/**
 * Generates text using DeepSeek V3 via AWS Bedrock
 *
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
export declare function generateText(request: AIGenerationRequest): Promise<AIGenerationResponse>;
/**
 * Generates text with streaming support
 * Returns an async generator that yields content chunks
 *
 * @param request - Generation request parameters
 * @returns Async generator yielding text chunks and final response
 */
export declare function generateTextStream(request: AIGenerationRequest): AsyncGenerator<string, AIGenerationResponse, undefined>;
//# sourceMappingURL=bedrock.d.ts.map