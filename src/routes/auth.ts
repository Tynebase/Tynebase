import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { loginRateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { sendEmail, emailTemplate } from '../services/email';

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
        // Start transaction by creating tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            subdomain: finalSubdomain,
            name: tenant_name,
            tier: 'free',
            settings: {},
            storage_limit: TIER_STORAGE.free, // Initialize with free tier storage
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
              total_credits: TIER_CREDITS.free,
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
                tier: 'free',
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

        // Send welcome email to the new user (non-critical)
        sendEmail({
          to: email,
          subject: 'Welcome to TyneBase! 🎉',
          html: emailTemplate(`
            <tr><td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111827;">Welcome to TyneBase${full_name ? `, ${full_name}` : ''}!</h1>
              <p style="margin: 0 0 20px; color: #6b7280;">Your account for <strong>${tenant_name}</strong> has been created successfully.</p>
              <p style="margin: 0 0 20px; color: #6b7280;">You can now create documents, use AI features, collaborate with your team, and publish your knowledge base.</p>
              <a href="https://tynebase.com/dashboard" style="display:inline-block;padding:12px 24px;background:#E85002;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px;">Need help? Reply to this email or visit our documentation.</p>
            </td></tr>
          `),
        }).catch(err => fastify.log.warn({ err }, 'Failed to send welcome email (non-critical)'));

        // Notify support about new signup (non-critical)
        sendEmail({
          to: 'support@tynebase.com',
          subject: `New signup: ${tenant_name} (${tier} plan)`,
          html: emailTemplate(`
            <tr><td style="padding: 32px 40px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #111827;">New Account Signup</h1>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Name</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${full_name || 'Not provided'}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Email</td><td style="padding:6px 0;color:#111827;font-size:14px;">${email}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Workspace</td><td style="padding:6px 0;color:#111827;font-size:14px;">${tenant_name}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Plan</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${tier}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Signed up at</td><td style="padding:6px 0;color:#111827;font-size:14px;">${new Date().toUTCString()}</td></tr>
              </table>
            </td></tr>
          `),
        }).catch(err => fastify.log.warn({ err }, 'Failed to send support notification (non-critical)'));

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

      // Create tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          subdomain: finalSubdomain,
          name: tenant_name,
          tier: 'free',
          settings: {},
          storage_limit: TIER_STORAGE.free,
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
          total_credits: TIER_CREDITS.free,
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
          tenant: { id: tenantId, subdomain, name: tenant_name, tier: 'free' },
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

      // Resolve target tenant from x-tenant-subdomain header if present.
      // This ensures that logging in from a specific subdomain returns the
      // correct workspace instead of a random one.
      const loginSubdomain = (request.headers['x-tenant-subdomain'] as string | undefined)?.toLowerCase();
      const hasLoginSubdomain = !!loginSubdomain && loginSubdomain !== 'www' && loginSubdomain !== 'main' && loginSubdomain !== 'app';
      let loginTargetTenantId: string | null = null;

      if (hasLoginSubdomain) {
        const { data: targetTenant } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', loginSubdomain)
          .maybeSingle();
        if (targetTenant) {
          loginTargetTenantId = targetTenant.id;
        }
      }

      // Get all user profiles across tenants (handle multiple rows per ID due to composite key)
      const { data: users, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, is_super_admin, status, tenant_id, original_tenant_id')
        .eq('id', data.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (profileError || !users || users.length === 0) {
        fastify.log.error({ error: profileError }, 'Failed to fetch user profile');
        return reply.code(500).send({
          error: {
            code: 'PROFILE_ERROR',
            message: 'Failed to retrieve user profile',
            details: {},
          },
        });
      }

      // Determine which profile row to use:
      // 1. If x-tenant-subdomain header pointed to a specific tenant, use that
      // 2. Prefer the home workspace (original_tenant_id IS NULL = they created it)
      // 3. Prefer admin role
      // 4. Fallback to first active row
      let userProfile;
      if (loginTargetTenantId) {
        userProfile = users.find(u => u.tenant_id === loginTargetTenantId);
      }
      if (!userProfile) {
        userProfile =
          users.find(u => u.original_tenant_id === null || u.original_tenant_id === u.tenant_id) ||
          users.find(u => u.role === 'admin' || u.is_super_admin) ||
          users[0];
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

      // Only set the user ID - profile lookup is done in the main handler
      request.user = {
        id: user.id,
        email: user.email || '',
        full_name: null,
        role: '',
        tenant_id: '',
        is_super_admin: false,
      };
    },
  }, async (request, reply) => {
    try {
      const userId = request.user!.id;

      // Resolve the active tenant from the `x-tenant-subdomain` header. The
      // frontend apiClient always sends this (see lib/api/client.ts); the raw
      // fetches in /auth/oauth-login and /community/join/finalize send it
      // explicitly. If it's missing or generic (`www`/`main`), we fall back
      // to "any active profile, admin preferred" — this is the bare-domain
      // sign-in case.
      const subdomain = (request.headers['x-tenant-subdomain'] as string | undefined)?.toLowerCase();
      const hasExplicitSubdomain = !!subdomain && subdomain !== 'www' && subdomain !== 'main';

      let targetTenantId: string | null = null;
      if (hasExplicitSubdomain) {
        const { data: targetTenant } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', subdomain)
          .maybeSingle();

        if (!targetTenant) {
          // Unknown subdomain — surface cleanly rather than silently falling
          // back to some other workspace.
          fastify.log.warn({ userId, subdomain }, '/me: unknown subdomain');
          return reply.code(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'No workspace exists at this address.',
              details: {},
            },
          });
        }
        targetTenantId = targetTenant.id;
      }

      // Fetch the user's row(s). With the composite (id, tenant_id) PK, a
      // user can have multiple rows; we pick exactly one deterministically
      // based on the resolved tenant context.
      let query = supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, is_super_admin, status, last_active_at, tenant_id, original_tenant_id')
        .eq('id', userId);

      if (targetTenantId) {
        query = query.eq('tenant_id', targetTenantId);
      }

      const { data: users, error } = await query;

      if (error) {
        fastify.log.error({ error, userId, subdomain }, '/me: users query failed');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to look up profile', details: {} },
        });
      }

      let userProfile;
      if (targetTenantId) {
        // Strict: the caller is on a specific subdomain, they must have a
        // row for THAT tenant. No silent fallback to another workspace.
        userProfile = users?.[0];
      } else {
        // Bare-domain fallback: prefer original_tenant_id (primary workspace), then admin role
        const activeUsers = (users || []).filter((u) => u.status === 'active');
        
        // First try to find the user's original/primary tenant.
        // original_tenant_id IS NULL means the user created this workspace (home).
        // original_tenant_id === tenant_id is an alternative way it may be marked.
        userProfile = activeUsers.find(
          (u) => u.original_tenant_id === null || u.original_tenant_id === u.tenant_id
        );
        
        // If no original tenant marked, prefer admin role
        if (!userProfile) {
          userProfile = activeUsers.find((u) => u.role === 'admin' || u.is_super_admin);
        }
        
        // Fallback to first active user
        if (!userProfile) {
          userProfile = activeUsers[0];
        }
      }

      if (!userProfile) {
        // User authenticated to Supabase but has no membership for this
        // tenant (or no membership at all). Signal PROFILE_NOT_FOUND so the
        // frontend can route them to signup / community-join / invite flows.
        fastify.log.warn({ userId, subdomain, targetTenantId }, '/me: no profile row for requested tenant');
        return reply.code(404).send({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: targetTenantId
              ? 'You do not have access to this workspace.'
              : 'User profile not found',
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

      // Update last_active_at — scoped to (id, tenant_id) so we don't
      // accidentally touch this user's other workspace memberships.
      await supabaseAdmin
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId)
        .eq('tenant_id', userProfile.tenant_id);

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

      // Resolve active tenant from x-tenant-subdomain header (same contract
      // as GET /api/auth/me). Without this, PATCH would pick an arbitrary
      // row and update across tenants.
      const subdomain = (request.headers['x-tenant-subdomain'] as string | undefined)?.toLowerCase();
      const hasExplicitSubdomain = !!subdomain && subdomain !== 'www' && subdomain !== 'main';

      let profileQuery = supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, tenant_id, is_super_admin')
        .eq('id', user.id);

      if (hasExplicitSubdomain) {
        const { data: targetTenant } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', subdomain)
          .maybeSingle();
        if (targetTenant) {
          profileQuery = profileQuery.eq('tenant_id', targetTenant.id);
        }
      } else {
        profileQuery = profileQuery.order('tenant_id', { ascending: true });
      }

      const { data: users, error: profileError } = await profileQuery.limit(1);

      const userProfile = users?.[0];

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
        full_name: userProfile.full_name || null,
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

      // Update user profile — scoped to the active (id, tenant_id) row so
      // changes to this workspace's profile don't bleed across the user's
      // other workspace memberships.
      const activeTenantId = request.user!.tenant_id;
      const { data: updatedUser, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .eq('tenant_id', activeTenantId)
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

      // Only block if the email is ALREADY a member of THIS specific tenant.
      // Rows in other tenants are fine — a user is allowed to join multiple
      // communities and may also be an admin elsewhere.
      const { data: existingInThisTenant } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existingInThisTenant) {
        return reply.code(400).send({
          error: { code: 'USER_EXISTS', message: 'An account with this email is already a member of this community.' },
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

      // Idempotent: if the user already has a row for THIS tenant, return
      // success immediately. If not, INSERT a brand-new (id, tenant_id) row.
      // We never touch rows in other tenants, and we never set
      // `is_super_admin` from this path — it's a platform-level flag that
      // belongs to superadmin-only mutations.
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id, tenant_id, role, full_name')
        .eq('id', userId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existingProfile) {
        return reply.code(200).send({
          success: true,
          data: {
            user: {
              id: userId,
              email,
              full_name: existingProfile.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name,
              role: existingProfile.role,
            },
            tenant: tenant,
          },
          message: 'Already a member of this community',
        });
      }

      // First-time community join for this tenant. The user may already be
      // a workspace admin or super-admin in a DIFFERENT tenant — that row is
      // left completely untouched. We simply add a new membership row.
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
          // NOTE: `is_super_admin` intentionally omitted — uses DB default.
        });

      if (profileError) {
        fastify.log.error({ error: profileError, userId, tenantId: tenant.id }, 'Failed to create community profile');
        return reply.code(500).send({
          error: { code: 'PROFILE_ERROR', message: 'Failed to create community profile' },
        });
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
