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
/**
 * Generates text using the appropriate AI provider based on tenant settings
 *
 * @param request - Generation request parameters
 * @param tenantSettings - Tenant's AI settings (optional)
 * @returns Generation response with content and token counts
 */
export declare function generateText(request: AIGenerationRequest, tenantSettings?: TenantAISettings | null): Promise<AIGenerationResponse>;
/**
 * Generates text with streaming using the appropriate AI provider
 *
 * @param request - Generation request parameters
 * @param tenantSettings - Tenant's AI settings (optional)
 * @returns Async generator yielding text chunks and final response
 */
export declare function generateTextStream(request: AIGenerationRequest, tenantSettings?: TenantAISettings | null): AsyncGenerator<string, AIGenerationResponse, undefined>;
//# sourceMappingURL=generation.d.ts.map