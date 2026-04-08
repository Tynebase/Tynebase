/**
 * Unified AI Generation Service
 * Routes generation requests to appropriate providers based on tenant settings
 * 
 * Features:
 * - Automatic provider routing based on tenant preferences
 * - Support for streaming and non-streaming generation
 * - Fallback to default provider if tenant settings unavailable
 */

import { AIGenerationRequest, AIGenerationResponse, TenantAISettings, AIModel } from './types';
import { routeToProvider } from './router';
import * as bedrock from './bedrock';
import * as anthropic from './anthropic';
import * as vertex from './vertex';

/**
 * Generates text using the appropriate AI provider based on tenant settings
 * 
 * @param request - Generation request parameters
 * @param tenantSettings - Tenant's AI settings (optional)
 * @returns Generation response with content and token counts
 */
export async function generateText(
  request: AIGenerationRequest,
  tenantSettings?: TenantAISettings | null
): Promise<AIGenerationResponse> {
  const providerConfig = routeToProvider(
    tenantSettings,
    'text-generation',
    request.model
  );

  switch (providerConfig.provider) {
    case 'bedrock':
      if (providerConfig.model === 'claude-sonnet-4.5') {
        try {
          return await anthropic.generateText(request);
        } catch (error: any) {
          // Fallback to deepseek-v3 for text generation only
          console.warn(`Claude failed, falling back to deepseek-v3:`, error.message);
          const fallbackRequest: AIGenerationRequest = { ...request, model: 'deepseek-v3' as AIModel };
          return await bedrock.generateText(fallbackRequest);
        }
      }
      return await bedrock.generateText(request);
    
    case 'vertex':
      // No fallback for Vertex - video/audio transcription handled separately in workers
      return await vertex.generateText(request);
    
    default:
      throw new Error(`Provider ${providerConfig.provider} does not support text generation`);
  }
}

/**
 * Generates text with streaming using the appropriate AI provider
 * 
 * @param request - Generation request parameters
 * @param tenantSettings - Tenant's AI settings (optional)
 * @returns Async generator yielding text chunks and final response
 */
export async function* generateTextStream(
  request: AIGenerationRequest,
  tenantSettings?: TenantAISettings | null
): AsyncGenerator<string, AIGenerationResponse, undefined> {
  const providerConfig = routeToProvider(
    tenantSettings,
    'text-generation',
    request.model
  );

  switch (providerConfig.provider) {
    case 'bedrock':
      if (providerConfig.model === 'claude-sonnet-4.5') {
        try {
          return yield* anthropic.generateTextStream(request);
        } catch (error: any) {
          // Fallback to deepseek-v3 for text generation only
          console.warn(`Claude streaming failed, falling back to deepseek-v3:`, error.message);
          const fallbackRequest: AIGenerationRequest = { ...request, model: 'deepseek-v3' as AIModel };
          return yield* bedrock.generateTextStream(fallbackRequest);
        }
      }
      return yield* bedrock.generateTextStream(request);
    
    case 'vertex':
      // No fallback for Vertex - video/audio transcription handled separately in workers
      return yield* vertex.generateTextStream(request);
    
    default:
      throw new Error(`Provider ${providerConfig.provider} does not support streaming text generation`);
  }
}
