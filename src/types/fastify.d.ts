import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: {
      id: string;
      subdomain: string;
      name: string;
      tier: string;
      settings: Record<string, any>;
      storage_limit: number | null;
    };
    user?: {
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      tenant_id: string;
      is_super_admin: boolean;
    };
  }
}
