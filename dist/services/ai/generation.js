"use strict";
/**
 * Unified AI Generation Service
 * Routes generation requests to appropriate providers based on tenant settings
 *
 * Features:
 * - Automatic provider routing based on tenant preferences
 * - Support for streaming and non-streaming generation
 * - Fallback to default provider if tenant settings unavailable
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
exports.generateTextStream = generateTextStream;
const router_1 = require("./router");
const bedrock = __importStar(require("./bedrock"));
const anthropic = __importStar(require("./anthropic"));
const vertex = __importStar(require("./vertex"));
/**
 * Generates text using the appropriate AI provider based on tenant settings
 *
 * @param request - Generation request parameters
 * @param tenantSettings - Tenant's AI settings (optional)
 * @returns Generation response with content and token counts
 */
async function generateText(request, tenantSettings) {
    const providerConfig = (0, router_1.routeToProvider)(tenantSettings, 'text-generation', request.model);
    switch (providerConfig.provider) {
        case 'bedrock':
            if (providerConfig.model === 'claude-sonnet-4.5') {
                try {
                    return await anthropic.generateText(request);
                }
                catch (error) {
                    // Fallback to deepseek-v3 for text generation only
                    console.warn(`Claude failed, falling back to deepseek-v3:`, error.message);
                    const fallbackRequest = { ...request, model: 'deepseek-v3' };
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
async function* generateTextStream(request, tenantSettings) {
    const providerConfig = (0, router_1.routeToProvider)(tenantSettings, 'text-generation', request.model);
    switch (providerConfig.provider) {
        case 'bedrock':
            if (providerConfig.model === 'claude-sonnet-4.5') {
                try {
                    return yield* anthropic.generateTextStream(request);
                }
                catch (error) {
                    // Fallback to deepseek-v3 for text generation only
                    console.warn(`Claude streaming failed, falling back to deepseek-v3:`, error.message);
                    const fallbackRequest = { ...request, model: 'deepseek-v3' };
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
//# sourceMappingURL=generation.js.map