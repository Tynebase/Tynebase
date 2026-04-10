"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = superAdminTestRoutes;
const auth_1 = require("../middleware/auth");
const superAdminGuard_1 = require("../middleware/superAdminGuard");
async function superAdminTestRoutes(fastify) {
    fastify.get('/api/superadmin/test', {
        preHandler: [auth_1.authMiddleware, superAdminGuard_1.superAdminGuard],
    }, async (request) => {
        if (!request.user) {
            throw new Error('User context missing after authentication');
        }
        return {
            success: true,
            message: 'Super admin access granted',
            user: {
                id: request.user.id,
                email: request.user.email,
                is_super_admin: request.user.is_super_admin,
            },
        };
    });
}
//# sourceMappingURL=superadmin-test.js.map