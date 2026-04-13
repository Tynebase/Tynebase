"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = testGeminiRoutes;
const vertex_1 = require("../services/ai/vertex");
const auth_1 = require("../middleware/auth");
const tenantContext_1 = require("../middleware/tenantContext");
const gcs_1 = require("../services/storage/gcs");
/**
 * Test endpoint for Gemini connectivity
 * GET /api/test/gemini
 * Tests Gemini with both text generation and audio transcription
 */
async function testGeminiRoutes(fastify) {
    fastify.get('/api/test/gemini', {
        preHandler: [
            auth_1.authMiddleware,
            tenantContext_1.tenantContextMiddleware,
        ],
    }, async (_request, reply) => {
        try {
            console.log('[TEST] Testing Gemini connectivity with text generation...');
            // First test: Simple text generation to verify basic connectivity
            const textResult = await (0, vertex_1.generateText)({
                prompt: 'Say "Gemini connection successful" in exactly those words.',
                maxTokens: 50,
                temperature: 0.1,
            });
            console.log('[TEST] Text generation successful:', {
                contentLength: textResult.content.length,
                tokensInput: textResult.tokensInput,
                tokensOutput: textResult.tokensOutput,
            });
            // Second test: GCS configuration check
            const gcsConfigured = (0, gcs_1.isGCSConfigured)();
            const gcsTest = {
                success: gcsConfigured,
                error: gcsConfigured ? '' : 'GCS not configured - check GCS_VIDEO_BUCKET and GCP_SERVICE_ACCOUNT_JSON'
            };
            console.log('[TEST] GCS configuration:', gcsTest);
            return reply.status(200).send({
                success: true,
                message: 'Gemini connection successful',
                text_test: {
                    content_length: textResult.content.length,
                    tokens_input: textResult.tokensInput,
                    tokens_output: textResult.tokensOutput,
                    model: textResult.model,
                    provider: textResult.provider,
                    content_preview: textResult.content.substring(0, 200),
                },
                gcs_test: gcsTest,
            });
        }
        catch (error) {
            console.error('[TEST] Gemini test failed:', error);
            return reply.status(500).send({
                success: false,
                message: 'Gemini connection failed',
                error: error.message,
                error_type: error.constructor?.name,
            });
        }
    });
}
//# sourceMappingURL=test-gemini.js.map