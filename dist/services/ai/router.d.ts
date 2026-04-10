/**
 * AI Provider Router
 * Routes AI requests to the appropriate provider based on tenant settings
 *
 * Supported Providers:
 * - AWS Bedrock (eu-west-2): deepseek-v3 (default), claude-sonnet-4.5
 * - Vertex AI London (europe-west2): gemini-2.5-flash (video/audio)
 */
import { AIProvider, AIModel, AIProviderConfig, TenantAISettings, AICapability } from './types';
/**
 * Routes to the appropriate AI provider based on tenant settings and capability requirements
 *
 * @param tenantSettings - Tenant's AI settings from tenants.settings
 * @param capability - Required capability (text-generation, video-transcription, etc.)
 * @param preferredModel - Optional model preference
 * @returns Provider configuration
 * @throws Error if provider is invalid or capability not supported
 */
export declare function routeToProvider(tenantSettings: TenantAISettings | null | undefined, capability?: AICapability, preferredModel?: AIModel): AIProviderConfig;
/**
 * Gets all available models for a given capability
 *
 * @param capability - Required capability
 * @returns Array of model names
 */
export declare function getAvailableModels(capability: AICapability): AIModel[];
/**
 * Validates if a provider supports a specific capability
 *
 * @param provider - AI provider name
 * @param capability - Required capability
 * @returns true if supported, false otherwise
 */
export declare function supportsCapability(provider: AIProvider, capability: AICapability): boolean;
/**
 * Gets provider configuration for a specific model
 *
 * @param model - AI model name
 * @returns Provider configuration
 * @throws Error if model not found
 */
export declare function getProviderForModel(model: AIModel): AIProviderConfig;
//# sourceMappingURL=router.d.ts.map