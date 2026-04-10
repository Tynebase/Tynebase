"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = testRoutes;
const tenantContext_1 = require("../middleware/tenantContext");
async function testRoutes(fastify) {
    fastify.get('/api/test/tenant', { preHandler: tenantContext_1.tenantContextMiddleware }, async (request) => {
        return {
            success: true,
            tenant: request.tenant,
            message: 'Tenant context resolved successfully',
        };
    });
}
//# sourceMappingURL=test.js.map