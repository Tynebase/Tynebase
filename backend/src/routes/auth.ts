import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { loginRateLimitMiddleware } from '../middleware/rateLimit';

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenant_name: z.string().min(1, 'Tenant name is required'),
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
    .regex(/^[a-z0-9]/, 'Subdomain must start with a letter or number')
    .regex(/[a-z0-9]$/, 'Subdomain must end with a letter or number'),
  full_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/signup
   * Creates a new tenant with admin user and storage buckets
   */
  fastify.post('/api/auth/signup', async (request, reply) => {
    try {
      const body = signupSchema.parse(request.body);
      const { email, password, tenant_name, subdomain, full_name } = body;

      fastify.log.info({ subdomain, email }, 'Starting signup process');

      // Check if subdomain already exists
      const { data: existingTenant, error: checkError } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('subdomain', subdomain)
        .single();

      if (existingTenant) {
        return reply.code(400).send({
          error: {
            code: 'SUBDOMAIN_EXISTS',
            message: 'Subdomain already taken',
            details: { subdomain },
          },
        });
      }

      if (checkError && checkError.code !== 'PGRST116') {
        fastify.log.error({ error: checkError }, 'Error checking subdomain');
        throw checkError;
      }

      // Create user in auth.users using Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || null,
        },
      });

      if (authError || !authData.user) {
        fastify.log.error({ error: authError }, 'Failed to create auth user');
        return reply.code(400).send({
          error: {
            code: 'AUTH_ERROR',
            message: authError?.message || 'Failed to create user',
            details: {},
          },
        });
      }

      const userId = authData.user.id;
      fastify.log.info({ userId }, 'Auth user created');

      try {
        // Start transaction by creating tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            subdomain,
            name: tenant_name,
            tier: 'free',
            settings: {},
            storage_limit: 1073741824, // 1GB
          })
          .select()
          .single();

        if (tenantError || !tenant) {
          fastify.log.error({ error: tenantError }, 'Failed to create tenant');
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw tenantError;
        }

        const tenantId = tenant.id;
        fastify.log.info({ tenantId }, 'Tenant created');

        // Create user profile in public.users
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            tenant_id: tenantId,
            email,
            full_name: full_name || null,
            role: 'admin',
            is_super_admin: false,
            status: 'active',
          });

        if (userError) {
          fastify.log.error({ error: userError }, 'Failed to create user profile');
          // Rollback: delete tenant and auth user
          await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw userError;
        }

        fastify.log.info({ userId, tenantId }, 'User profile created');

        // Create storage buckets for tenant
        const bucketNames = [
          `tenant-${tenantId}-uploads`,
          `tenant-${tenantId}-documents`,
        ];

        for (const bucketName of bucketNames) {
          const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucketName, {
            public: false,
          });

          if (bucketError) {
            // Check if bucket already exists (not a critical error)
            if (bucketError.message?.includes('already exists')) {
              fastify.log.warn({ bucketName }, 'Bucket already exists, continuing');
            } else {
              fastify.log.error({ error: bucketError, bucketName }, 'Failed to create bucket');
              // Rollback: delete user, tenant, and auth user
              await supabaseAdmin.from('users').delete().eq('id', userId);
              await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
              await supabaseAdmin.auth.admin.deleteUser(userId);
              throw bucketError;
            }
          } else {
            fastify.log.info({ bucketName }, 'Storage bucket created');
          }
        }

        // Create initial credit pool for the tenant (non-critical - can be created later)
        try {
          const { error: creditError } = await supabaseAdmin
            .from('credit_pools')
            .insert({
              tenant_id: tenantId,
              month_year: new Date().toISOString().slice(0, 7), // YYYY-MM format
              total_credits: 100, // Free tier: 100 credits
              used_credits: 0,
            });

          if (creditError) {
            fastify.log.warn({ error: creditError }, 'Failed to create credit pool (non-critical)');
          } else {
            fastify.log.info({ tenantId }, 'Credit pool created');
          }
        } catch (creditException) {
          fastify.log.warn({ error: creditException }, 'Credit pool creation exception (non-critical)');
        }

        fastify.log.info({ userId, tenantId, subdomain }, 'Signup completed successfully');

        return reply.code(201).send({
          success: true,
          data: {
            user: {
              id: userId,
              email,
              full_name: full_name || null,
              role: 'admin',
            },
            tenant: {
              id: tenantId,
              subdomain,
              name: tenant_name,
              tier: 'free',
            },
          },
          message: 'Account created successfully',
        });
      } catch (transactionError) {
        fastify.log.error({ error: transactionError }, 'Transaction failed, rolling back');
        return reply.code(500).send({
          error: {
            code: 'SIGNUP_FAILED',
            message: 'Failed to complete signup. Please try again.',
            details: {},
          },
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      fastify.log.error({ error }, 'Unexpected error during signup');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticates user and returns JWT
   * Rate limited to 5 attempts per 15 minutes per IP
   */
  fastify.post('/api/auth/login', {
    preHandler: loginRateLimitMiddleware,
  }, async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const { email, password } = body;

      fastify.log.info({ email }, 'Login attempt');

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        fastify.log.warn({ email, error }, 'Login failed');
        return reply.code(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            details: {},
          },
        });
      }

      // Get user profile with tenant info
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          is_super_admin,
          status,
          tenant_id,
          tenants (
            id,
            subdomain,
            name,
            tier,
            settings
          )
        `)
        .eq('id', data.user.id)
        .single();

      if (profileError || !userProfile) {
        fastify.log.error({ error: profileError }, 'Failed to fetch user profile');
        return reply.code(500).send({
          error: {
            code: 'PROFILE_ERROR',
            message: 'Failed to retrieve user profile',
            details: {},
          },
        });
      }

      // Check if user is suspended
      if (userProfile.status === 'suspended') {
        return reply.code(403).send({
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended',
            details: {},
          },
        });
      }

      fastify.log.info({ userId: data.user.id }, 'Login successful');

      return reply.code(200).send({
        success: true,
        data: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
          user: {
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            role: userProfile.role,
            is_super_admin: userProfile.is_super_admin,
          },
          tenant: userProfile.tenants,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      fastify.log.error({ error }, 'Unexpected error during login');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      });
    }
  });

  /**
   * GET /api/auth/me
   * Returns current user profile and tenant settings
   * Requires authentication
   */
  fastify.get('/api/auth/me', {
    preHandler: async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
            details: {},
          },
        });
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return reply.code(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            details: {},
          },
        });
      }

      // Fetch user profile to get tenant_id and role
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id, email, role, tenant_id, is_super_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        return reply.code(401).send({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User profile not found',
            details: {},
          },
        });
      }

      request.user = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        tenant_id: userProfile.tenant_id,
        is_super_admin: userProfile.is_super_admin,
      };
    },
  }, async (request, reply) => {
    try {
      const userId = request.user!.id;

      const { data: userProfile, error } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          is_super_admin,
          status,
          last_active_at,
          tenant_id,
          tenants (
            id,
            subdomain,
            name,
            tier,
            settings,
            storage_limit
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !userProfile) {
        fastify.log.error({ error }, 'Failed to fetch user profile');
        return reply.code(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found',
            details: {},
          },
        });
      }

      // Update last_active_at
      await supabaseAdmin
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            role: userProfile.role,
            is_super_admin: userProfile.is_super_admin,
            status: userProfile.status,
            last_active_at: userProfile.last_active_at,
          },
          tenant: userProfile.tenants,
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Unexpected error in /me endpoint');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      });
    }
  });
}
