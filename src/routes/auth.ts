import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { loginRateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

// Tier credit allocations
const TIER_CREDITS: Record<string, number> = {
  free: 10,
  base: 100,
  pro: 500,
  enterprise: 1000,
};

// Tier storage limits (in bytes)
const TIER_STORAGE: Record<string, number> = {
  free: 524288000,      // 500MB
  base: 5368709120,     // 5GB
  pro: 53687091200,     // 50GB
  enterprise: -1,       // Unlimited
};

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenant_name: z.string().min(1, 'Tenant name is required'),
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
    .regex(/^[a-z0-9]/, 'Subdomain must start with a letter or number')
    .regex(/[a-z0-9]$/, 'Subdomain must end with a letter or number')
    .optional(),
  full_name: z.string().optional(),
  tier: z.enum(['free', 'base', 'pro', 'enterprise']).optional().default('free'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Check if subdomain is available (for Pro/Enterprise tiers only)
async function checkSubdomainAvailable(subdomain: string): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('subdomain', subdomain)
    .single();
  return !existing;
}

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/signup
   * Creates a new tenant with admin user and storage buckets
   */
  fastify.post('/api/auth/signup', async (request, reply) => {
    try {
      const body = signupSchema.parse(request.body);
      const { email, password, tenant_name, subdomain, full_name, tier } = body;

      fastify.log.info({ subdomain, email, tier }, 'Starting signup process');

      // Subdomain logic:
      // - Free: auto-generated subdomain (not displayed until upgrade)
      // - Base/Pro/Enterprise: custom subdomain required
      let finalSubdomain: string;

      if (tier === 'base' || tier === 'pro' || tier === 'enterprise') {
        if (!subdomain) {
          return reply.code(400).send({
            error: {
              code: 'SUBDOMAIN_REQUIRED',
              message: 'Base, Pro, and Enterprise plans require a custom subdomain.',
              details: {},
            },
          });
        }
        const isAvailable = await checkSubdomainAvailable(subdomain);
        if (!isAvailable) {
          return reply.code(400).send({
            error: {
              code: 'SUBDOMAIN_EXISTS',
              message: 'This subdomain is already taken. Please choose a different one.',
              details: { subdomain },
            },
          });
        }
        finalSubdomain = subdomain;
      } else {
        const baseSlug = tenant_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'workspace';
        let uniqueSubdomain = baseSlug;
        let isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
        let counter = 1;
        
        while (!isAvailable) {
          uniqueSubdomain = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
          isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
          counter++;
          if (counter > 10) {
            uniqueSubdomain = `ws-${Math.random().toString(36).substring(2, 10)}`;
            isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
          }
        }
        finalSubdomain = uniqueSubdomain;
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
        // Get tier-specific limits
        const tierCredits = TIER_CREDITS[tier] || TIER_CREDITS.free;
        const tierStorage = TIER_STORAGE[tier] || TIER_STORAGE.free;

        // Start transaction by creating tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            subdomain: finalSubdomain,
            name: tenant_name,
            tier: tier,
            settings: {},
            storage_limit: tierStorage > 0 ? tierStorage : 107374182400, // Use tier limit or 100GB for unlimited
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
              total_credits: tierCredits,
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

        // Sign in the newly created user to get session tokens
        const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError || !signInData.session) {
          fastify.log.error({ error: signInError }, 'Failed to sign in newly created user');
          // User was created but sign-in failed - still return success but without tokens
          // User can manually log in
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
                tier: tier,
              },
            },
            message: 'Account created successfully. Please log in.',
          });
        }

        fastify.log.info({ userId, tenantId, subdomain }, 'Signup completed successfully');

        writeAuditLog({
          tenantId,
          actorId: userId,
          action: 'auth.signup',
          actionType: 'auth',
          targetName: email,
          ipAddress: getClientIp(request),
          metadata: { full_name: full_name || null },
        });

        return reply.code(201).send({
          success: true,
          data: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_in: signInData.session.expires_in,
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
              tier: tier,
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
   * POST /api/auth/complete-oauth-signup
   * Completes signup for OAuth users (Google, etc.)
   * The auth user already exists from OAuth — this creates the tenant + user record.
   * Requires a valid JWT from the OAuth session.
   */
  fastify.post('/api/auth/complete-oauth-signup', async (request, reply) => {
    try {
      const oauthSignupSchema = z.object({
        tenant_name: z.string().min(1, 'Workspace name is required'),
        subdomain: z.string()
          .min(3, 'Subdomain must be at least 3 characters')
          .max(63)
          .regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
          .regex(/^[a-z0-9]/, 'Subdomain must start with a letter or number')
          .regex(/[a-z0-9]$/, 'Subdomain must end with a letter or number')
          .optional(), // Only required for Pro/Enterprise
        tier: z.enum(['free', 'base', 'pro', 'enterprise']).optional().default('free'),
        full_name: z.string().optional(),
      });

      const body = oauthSignupSchema.parse(request.body);
      const { tenant_name, subdomain, tier, full_name } = body;

      // Verify JWT from OAuth session
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
        });
      }

      const token = authHeader.substring(7);
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !authUser) {
        return reply.code(401).send({
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        });
      }

      const userId = authUser.id;
      const email = authUser.email!;

      fastify.log.info({ userId, email, subdomain }, 'Completing OAuth signup');

      // Check if user already has a profile (already completed signup)
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id, tenant_id')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        // Already has a profile — fetch tenant and return
        const { data: existingTenant } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier')
          .eq('id', existingProfile.tenant_id)
          .single();

        return reply.code(200).send({
          success: true,
          data: {
            user: { id: userId, email, full_name, role: 'admin' },
            tenant: existingTenant,
          },
          message: 'Signup already completed',
        });
      }

      // Subdomain logic:
      // - Free: auto-generated subdomain (not displayed until upgrade)
      // - Base/Pro/Enterprise: custom subdomain required
      let finalSubdomain: string;

      if (tier === 'base' || tier === 'pro' || tier === 'enterprise') {
        if (!subdomain) {
          return reply.code(400).send({
            error: { code: 'SUBDOMAIN_REQUIRED', message: 'Base, Pro, and Enterprise plans require a custom subdomain.', details: {} },
          });
        }
        const isAvailable = await checkSubdomainAvailable(subdomain);
        if (!isAvailable) {
          return reply.code(400).send({
            error: { code: 'SUBDOMAIN_EXISTS', message: 'This subdomain is already taken. Please choose a different one.', details: { subdomain } },
          });
        }
        finalSubdomain = subdomain;
      } else {
        const baseSlug = tenant_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'workspace';
        let uniqueSubdomain = baseSlug;
        let isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
        let counter = 1;
        
        while (!isAvailable) {
          uniqueSubdomain = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
          isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
          counter++;
          if (counter > 10) {
            uniqueSubdomain = `ws-${Math.random().toString(36).substring(2, 10)}`;
            isAvailable = await checkSubdomainAvailable(uniqueSubdomain);
          }
        }
        finalSubdomain = uniqueSubdomain;
      }

      // Get tier-specific limits
      const tierCredits = TIER_CREDITS[tier] || TIER_CREDITS.free;
      const tierStorage = TIER_STORAGE[tier] || TIER_STORAGE.free;

      // Create tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          subdomain: finalSubdomain,
          name: tenant_name,
          tier,
          settings: {},
          storage_limit: tierStorage > 0 ? tierStorage : 107374182400,
        })
        .select()
        .single();

      if (tenantError || !tenant) {
        fastify.log.error({ error: tenantError }, 'Failed to create tenant for OAuth user');
        throw tenantError;
      }

      const tenantId = tenant.id;

      // Update auth user metadata with full_name if provided
      if (full_name) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { ...authUser.user_metadata, full_name },
        });
      }

      // Create user profile
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          tenant_id: tenantId,
          email,
          full_name: full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
          role: 'admin',
          is_super_admin: false,
          status: 'active',
        });

      if (userError) {
        fastify.log.error({ error: userError }, 'Failed to create user profile for OAuth user');
        await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        throw userError;
      }

      // Create storage buckets
      for (const bucketName of [`tenant-${tenantId}-uploads`, `tenant-${tenantId}-documents`]) {
        const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucketName, { public: false });
        if (bucketError && !bucketError.message?.includes('already exists')) {
          fastify.log.error({ error: bucketError, bucketName }, 'Failed to create bucket');
          await supabaseAdmin.from('users').delete().eq('id', userId);
          await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
          throw bucketError;
        }
      }

      // Create credit pool (non-critical)
      try {
        await supabaseAdmin.from('credit_pools').insert({
          tenant_id: tenantId,
          month_year: new Date().toISOString().slice(0, 7),
          total_credits: tierCredits,
          used_credits: 0,
        });
      } catch (creditErr) {
        fastify.log.warn({ error: creditErr }, 'Credit pool creation failed (non-critical)');
      }

      fastify.log.info({ userId, tenantId, subdomain }, 'OAuth signup completed');

      writeAuditLog({
        tenantId,
        actorId: userId,
        action: 'auth.oauth_signup',
        actionType: 'auth',
        targetName: email,
        ipAddress: getClientIp(request),
        metadata: { provider: 'google', full_name: full_name || null },
      });

      return reply.code(201).send({
        success: true,
        data: {
          user: { id: userId, email, full_name: full_name || null, role: 'admin' },
          tenant: { id: tenantId, subdomain, name: tenant_name, tier },
        },
        message: 'Workspace created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors },
        });
      }
      fastify.log.error({ error }, 'Unexpected error in complete-oauth-signup');
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
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

      // Get user profile
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, is_super_admin, status, tenant_id')
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

      // Get tenant info separately
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name, tier, settings')
        .eq('id', userProfile.tenant_id)
        .single();

      if (tenantError || !tenant) {
        fastify.log.error({ error: tenantError }, 'Failed to fetch tenant');
        return reply.code(500).send({
          error: {
            code: 'TENANT_ERROR',
            message: 'Failed to retrieve tenant information',
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

      // Check if user was deleted (left workspace or was removed)
      if (userProfile.status === 'deleted') {
        return reply.code(403).send({
          error: {
            code: 'ACCOUNT_DELETED',
            message: 'Your account has been removed from this workspace. You can create a new workspace or wait to be invited to another one.',
            details: {
              can_create_workspace: true,
              email: userProfile.email,
            },
          },
        });
      }

      fastify.log.info({ userId: data.user.id }, 'Login successful');

      writeAuditLog({
        tenantId: userProfile.tenant_id,
        actorId: userProfile.id,
        action: 'auth.login',
        actionType: 'auth',
        targetName: userProfile.email,
        ipAddress: getClientIp(request),
        metadata: { role: userProfile.role },
      });

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
          tenant: tenant,
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
        .select('id, email, full_name, role, is_super_admin, status, last_active_at, tenant_id, original_tenant_id')
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

      // Check if user was deleted
      if (userProfile.status === 'deleted') {
        return reply.code(403).send({
          error: {
            code: 'ACCOUNT_DELETED',
            message: 'Your account has been removed from this workspace.',
            details: {
              can_create_workspace: true,
              email: userProfile.email,
            },
          },
        });
      }

      // Get tenant info separately
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name, tier, settings, storage_limit')
        .eq('id', userProfile.tenant_id)
        .single();

      if (tenantError || !tenant) {
        fastify.log.error({ error: tenantError }, 'Failed to fetch tenant');
        return reply.code(500).send({
          error: {
            code: 'TENANT_ERROR',
            message: 'Failed to retrieve tenant information',
            details: {},
          },
        });
      }

      // Update last_active_at
      await supabaseAdmin
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);

      // User is original admin if they are admin AND have no original_tenant_id (they created this workspace)
      const isOriginalAdmin = userProfile.role === 'admin' && userProfile.original_tenant_id === null;

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            role: userProfile.role,
            is_super_admin: userProfile.is_super_admin,
            is_original_admin: isOriginalAdmin,
            status: userProfile.status,
            last_active_at: userProfile.last_active_at,
          },
          tenant: tenant,
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

  /**
   * PATCH /api/auth/me
   * Updates current user profile information
   * Requires authentication
   */
  fastify.patch('/api/auth/me', {
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
      const updateSchema = z.object({
        full_name: z.string().min(1).max(255).optional(),
        avatar_url: z.string().url().optional().nullable(),
        notification_preferences: z.object({
          email_notifications: z.boolean().optional(),
          push_notifications: z.boolean().optional(),
          weekly_digest: z.boolean().optional(),
          marketing_emails: z.boolean().optional(),
        }).optional(),
        language: z.string().min(2).max(10).optional(),
        timezone: z.string().min(1).max(50).optional(),
      });

      const body = updateSchema.parse(request.body);

      // Build update object dynamically
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.full_name !== undefined) updateData.full_name = body.full_name;
      if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;
      if (body.notification_preferences !== undefined) {
        updateData.notification_preferences = body.notification_preferences;
      }
      if (body.language !== undefined) updateData.language = body.language;
      if (body.timezone !== undefined) updateData.timezone = body.timezone;

      // Update user profile
      const { data: updatedUser, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, email, full_name, avatar_url, notification_preferences, language, timezone, role, is_super_admin, status, last_active_at, tenant_id')
        .single();

      if (error || !updatedUser) {
        fastify.log.error({ error }, 'Failed to update user profile');
        return reply.code(500).send({
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update user profile',
            details: {},
          },
        });
      }

      // Get tenant info
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name, tier, settings, storage_limit')
        .eq('id', updatedUser.tenant_id)
        .single();

      if (tenantError || !tenant) {
        fastify.log.error({ error: tenantError }, 'Failed to fetch tenant');
        return reply.code(500).send({
          error: {
            code: 'TENANT_ERROR',
            message: 'Failed to retrieve tenant information',
            details: {},
          },
        });
      }

      writeAuditLog({
        tenantId: updatedUser.tenant_id,
        actorId: updatedUser.id,
        action: 'user.profile_updated',
        actionType: 'user',
        targetName: updatedUser.full_name || updatedUser.email,
        ipAddress: getClientIp(request),
        metadata: { fields_updated: Object.keys(body) },
      });

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            full_name: updatedUser.full_name,
            avatar_url: updatedUser.avatar_url,
            notification_preferences: updatedUser.notification_preferences,
            language: updatedUser.language,
            timezone: updatedUser.timezone,
            role: updatedUser.role,
            is_super_admin: updatedUser.is_super_admin,
            status: updatedUser.status,
            last_active_at: updatedUser.last_active_at,
          },
          tenant: tenant,
        },
        message: 'Profile updated successfully',
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

      fastify.log.error({ error }, 'Unexpected error in PATCH /me endpoint');
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
   * POST /api/auth/refresh
   * Refreshes access token using refresh token
   */
  fastify.post('/api/auth/refresh', async (request, reply) => {
    try {
      const refreshSchema = z.object({
        refresh_token: z.string().min(1, 'Refresh token is required'),
      });

      const body = refreshSchema.parse(request.body);
      const { refresh_token } = body;

      fastify.log.info('Token refresh attempt');

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token,
      });

      if (error || !data.session) {
        fastify.log.warn({ error }, 'Token refresh failed');
        return reply.code(401).send({
          error: {
            code: 'REFRESH_FAILED',
            message: 'Invalid or expired refresh token',
            details: {},
          },
        });
      }

      fastify.log.info({ userId: data.user?.id }, 'Token refresh successful');

      return reply.code(200).send({
        success: true,
        data: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
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

      fastify.log.error({ error }, 'Unexpected error during token refresh');
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
   * POST /api/auth/community/join
   * Joins an existing tenant as a community member
   */
  fastify.post('/api/auth/community/join', async (request, reply) => {
    try {
      const joinSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        full_name: z.string().min(1),
        subdomain: z.string(),
      });

      const { email, password, full_name, subdomain } = joinSchema.parse(request.body);

      // Resolve tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, name, subdomain')
        .eq('subdomain', subdomain.toLowerCase())
        .single();

      if (tenantError || !tenant) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
        });
      }

      // Check if user already has a profile for this tenant
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return reply.code(400).send({
          error: { code: 'USER_EXISTS', message: 'An account with this email already exists on TyneBase.' },
        });
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (authError || !authData.user) {
        return reply.code(400).send({
          error: { code: 'AUTH_ERROR', message: authError?.message || 'Failed to create account' },
        });
      }

      const userId = authData.user.id;

      // Create community_contributor profile
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          tenant_id: tenant.id,
          email: email.toLowerCase(),
          full_name,
          role: 'community_contributor',
          status: 'active',
        });

      if (profileError) {
        fastify.log.error({ error: profileError }, 'Failed to create community profile');
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return reply.code(500).send({
          error: { code: 'PROFILE_ERROR', message: 'Failed to create community profile' },
        });
      }

      // Sign in
      const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      return reply.code(201).send({
        success: true,
        data: {
          access_token: signInData.session?.access_token,
          refresh_token: signInData.session?.refresh_token,
          user: {
            id: userId,
            email,
            full_name,
            role: 'community_contributor',
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
          },
        },
        message: 'Joined community successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      }
      fastify.log.error({ error }, 'Unexpected error in community join');
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  });

  /**
   * POST /api/auth/community/finalize-oauth-join
   * Finalizes community join for OAuth users (Google, etc.)
   */
  fastify.post('/api/auth/community/finalize-oauth-join', async (request, reply) => {
    try {
      const finalizeSchema = z.object({
        subdomain: z.string(),
      });

      const { subdomain } = finalizeSchema.parse(request.body);

      // Verify JWT from OAuth session
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
        });
      }

      const token = authHeader.substring(7);
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !authUser) {
        return reply.code(401).send({
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        });
      }

      const userId = authUser.id;
      const email = authUser.email!;

      // Resolve tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, name, subdomain')
        .eq('subdomain', subdomain.toLowerCase())
        .single();

      if (tenantError || !tenant) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
        });
      }

      // Check if user already has a profile (already a member of SOME workspace)
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id, tenant_id, role')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        // If already in this tenant, success
        if (existingProfile.tenant_id === tenant.id) {
          return reply.code(200).send({
            success: true,
            data: {
              user: { id: userId, email, full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name, role: existingProfile.role },
              tenant: tenant,
            },
            message: 'Already a member of this community',
          });
        }

        // If in another tenant, error
        return reply.code(403).send({
          error: { 
            code: 'ALREADY_MEMBER_OTHER', 
            message: 'Your account is already associated with another workspace. Please use a different email or logout from the other workspace.' 
          },
        });
      }

      // Create community_contributor profile
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Community Member';
      
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          tenant_id: tenant.id,
          email: email.toLowerCase(),
          full_name: fullName,
          role: 'community_contributor',
          status: 'active',
        });

      if (profileError) {
        fastify.log.error({ error: profileError }, 'Failed to create community profile');
        throw profileError;
      }

      return reply.code(201).send({
        success: true,
        data: {
          user: { id: userId, email, full_name: fullName, role: 'community_contributor' },
          tenant: tenant,
        },
        message: 'Joined community successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      }
      fastify.log.error({ error }, 'Unexpected error in community finalize-oauth-join');
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  });
}
