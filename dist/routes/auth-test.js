"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authTestRoutes;
const auth_1 = require("../middleware/auth");
async function authTestRoutes(fastify) {
    fastify.get('/api/test/auth', {
        preHandler: auth_1.authMiddleware,
    }, async (request) => {
        return {
            success: true,
            message: 'Authentication successful',
            user: request.user,
        };
    });
}
//# sourceMappingURL=auth-test.js.map