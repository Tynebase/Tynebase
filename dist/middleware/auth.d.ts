import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * JWT Authentication Middleware
 *
 * Verifies Supabase JWT token from Authorization header and populates request.user
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 *
 * Security:
 * - Verifies JWT signature using Supabase
 * - Checks token expiry automatically via Supabase SDK
 * - Validates issuer through Supabase configuration
 * - Queries database to get full user profile with tenant context
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=auth.d.ts.map