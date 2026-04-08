import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: {
      id: string;
      subdomain: string;
      name: string;
      tier: string;
      settings: Record<string, any>;
    };
    user?: {
      id: string;
      email: string;
      role: string;
      tenant_id: string;
      is_super_admin: boolean;
    };
  }
}
