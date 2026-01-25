/**
 * Unified AI Generation Service
 * Routes generation requests to appropriate providers based on tenant settings
 * 
 * Features:
 * - Automatic provider routing based on tenant preferences
 * - Support for streaming and non-streaming generation
 * - Fallback to default provider if tenant settings unavailable
 */

import { AIGenerationRequest, AIGenerationResponse, TenantAISettings } from './types';
import { routeToProvider } from './router';
import * as bedrock from './bedrock';
import * as anthropic from './anthropic';

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
        return anthropic.generateText(request);
      }
      return bedrock.generateText(request);
    
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
        return yield* anthropic.generateTextStream(request);
      }
      return yield* bedrock.generateTextStream(request);
    
    default:
      throw new Error(`Provider ${providerConfig.provider} does not support streaming text generation`);
  }
}
