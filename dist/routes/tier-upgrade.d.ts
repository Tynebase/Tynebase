import { FastifyInstance } from 'fastify';
/**
 * Mock tier upgrade route.
 * Allows upgrading a tenant's tier without real payment processing.
 * In production this would integrate with Stripe or similar.
 */
export default function tierUpgradeRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=tier-upgrade.d.ts.map