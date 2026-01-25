/**
 * AI Provider Router
 * Routes AI requests to the appropriate provider based on tenant settings
 * 
 * Supported Providers:
 * - AWS Bedrock (eu-west-2): deepseek-v3 (default), claude-sonnet-4.5
 * - Vertex AI London (europe-west2): gemini-3-flash (video/audio only)
 */

import { AIProvider, AIModel, AIProviderConfig, TenantAISettings, AICapability } from './types';

/**
 * Provider configurations with endpoints and capabilities
 */
const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig[]> = {
  bedrock: [
    {
      provider: 'bedrock',
      model: 'deepseek-v3',
      capabilities: ['text-generation'],
      endpoint: 'bedrock-runtime.eu-west-2.amazonaws.com',
      region: 'eu-west-2',
    },
    {
      provider: 'bedrock',
      model: 'claude-sonnet-4.5',
      capabilities: ['text-generation'],
      endpoint: 'bedrock-runtime.eu-west-2.amazonaws.com',
      region: 'eu-west-2',
    },
  ],
  vertex: [
    {
      provider: 'vertex',
      model: 'gemini-3-flash',
      capabilities: ['video-transcription', 'audio-transcription'],
      endpoint: 'https://europe-west2-aiplatform.googleapis.com',
      region: 'europe-west2',
    },
  ],
};

/**
 * Default provider for text generation
 */
const DEFAULT_PROVIDER: AIProvider = 'bedrock';
const DEFAULT_MODEL: AIModel = 'deepseek-v3';

/**
 * Valid provider names for validation
 */
const VALID_PROVIDERS: AIProvider[] = ['bedrock', 'vertex'];

/**
 * Routes to the appropriate AI provider based on tenant settings and capability requirements
 * 
 * @param tenantSettings - Tenant's AI settings from tenants.settings
 * @param capability - Required capability (text-generation, video-transcription, etc.)
 * @param preferredModel - Optional model preference
 * @returns Provider configuration
 * @throws Error if provider is invalid or capability not supported
 */
export function routeToProvider(
  tenantSettings: TenantAISettings | null | undefined,
  capability: AICapability = 'text-generation',
  preferredModel?: AIModel
): AIProviderConfig {
  // Extract provider preference from tenant settings
  const requestedProvider = tenantSettings?.ai_provider;
  const requestedModel = preferredModel || tenantSettings?.preferred_model;

  // Validate provider name if specified
  if (requestedProvider && !VALID_PROVIDERS.includes(requestedProvider)) {
    throw new Error(
      `Invalid AI provider: ${requestedProvider}. Valid providers: ${VALID_PROVIDERS.join(', ')}`
    );
  }

  // For video/audio transcription, always use Vertex AI
  if (capability === 'video-transcription' || capability === 'audio-transcription') {
    const vertexConfig = PROVIDER_CONFIGS.vertex[0];
    if (!vertexConfig) {
      throw new Error('Vertex AI configuration not found');
    }
    return vertexConfig;
  }

  // If a specific model is requested, find its provider
  if (requestedModel) {
    const config = findConfigByModel(requestedModel);
    if (config && config.capabilities.includes(capability)) {
      return config;
    }
    throw new Error(
      `Model ${requestedModel} not found or does not support capability: ${capability}`
    );
  }

  // If a provider is specified, use it with default model for that provider
  if (requestedProvider) {
    const providerConfigs = PROVIDER_CONFIGS[requestedProvider];
    if (!providerConfigs || providerConfigs.length === 0) {
      throw new Error(`No configurations found for provider: ${requestedProvider}`);
    }

    // Find first config that supports the required capability
    const config = providerConfigs.find(c => c.capabilities.includes(capability));
    if (!config) {
      throw new Error(
        `Provider ${requestedProvider} does not support capability: ${capability}`
      );
    }
    return config;
  }

  // Default: use OpenAI for text generation
  const defaultConfig = PROVIDER_CONFIGS[DEFAULT_PROVIDER].find(
    c => c.model === DEFAULT_MODEL
  );
  if (!defaultConfig) {
    throw new Error('Default provider configuration not found');
  }
  return defaultConfig;
}

/**
 * Finds provider configuration by model name
 * 
 * @param model - AI model name
 * @returns Provider configuration or undefined
 */
function findConfigByModel(model: AIModel): AIProviderConfig | undefined {
  for (const provider of VALID_PROVIDERS) {
    const config = PROVIDER_CONFIGS[provider].find(c => c.model === model);
    if (config) {
      return config;
    }
  }
  return undefined;
}

/**
 * Gets all available models for a given capability
 * 
 * @param capability - Required capability
 * @returns Array of model names
 */
export function getAvailableModels(capability: AICapability): AIModel[] {
  const models: AIModel[] = [];
  for (const provider of VALID_PROVIDERS) {
    const configs = PROVIDER_CONFIGS[provider];
    for (const config of configs) {
      if (config.capabilities.includes(capability)) {
        models.push(config.model);
      }
    }
  }
  return models;
}

/**
 * Validates if a provider supports a specific capability
 * 
 * @param provider - AI provider name
 * @param capability - Required capability
 * @returns true if supported, false otherwise
 */
export function supportsCapability(provider: AIProvider, capability: AICapability): boolean {
  const configs = PROVIDER_CONFIGS[provider];
  return configs.some(c => c.capabilities.includes(capability));
}

/**
 * Gets provider configuration for a specific model
 * 
 * @param model - AI model name
 * @returns Provider configuration
 * @throws Error if model not found
 */
export function getProviderForModel(model: AIModel): AIProviderConfig {
  const config = findConfigByModel(model);
  if (!config) {
    throw new Error(`No provider configuration found for model: ${model}`);
  }
  return config;
}
