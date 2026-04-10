"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = aiTestRoutes;
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
/**
 * AI test route for validating AI endpoint rate limiting (10 req/min)
 */
async function aiTestRoutes(fastify) {
    fastify.get('/api/ai/test', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware],
    }, async (request) => {
        return {
            success: true,
            message: 'AI test endpoint',
            user: request.user?.id,
        };
    });
}
//# sourceMappingURL=ai-test.js.map