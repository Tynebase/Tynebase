import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { dispatchJob } from '../utils/dispatchJob';
import { z } from 'zod';

/**
 * GDPR Compliance Routes
 * 
 * Implements user rights under GDPR:
 * - Data export (right to data portability)
 * - Account deletion (right to be forgotten)
 */
export default async function gdprRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/gdpr/export
   * 
   * Exports all user data in JSON format for GDPR compliance
   * 
   * Returns:
   * - User profile information
   * - All documents created by the user
   * - Usage history (AI queries, credits charged)
   * - Templates created by the user
   * - Audit trail metadata
   * 
   * Security:
   * - Requires authentication
   * - Users can only export their own data
   * - Includes audit trail in export
   */
  fastify.get(
    '/api/gdpr/export',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const user = (request as any).user;
      const userId = user.id;
      const tenantId = user.tenant_id;

      try {
        fastify.log.info(
          { userId, tenantId },
          'Starting GDPR data export'
        );

        // 1. Fetch user profile data
        const { data: userProfile, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, role, status, last_active_at, created_at, updated_at')
          .eq('id', userId)
          .single();

        if (userError) {
          fastify.log.error({ userId, error: userError }, 'Failed to fetch user profile');
          throw userError;
        }

        // 2. Fetch tenant information
        const { data: tenantData, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, created_at')
          .eq('id', tenantId)
          .single();

        if (tenantError) {
          fastify.log.error({ tenantId, error: tenantError }, 'Failed to fetch tenant data');
          throw tenantError;
        }

        // 3. Fetch all documents created by the user
        const { data: documents, error: documentsError } = await supabaseAdmin
          .from('documents')
          .select('id, title, content, parent_id, is_public, status, published_at, created_at, updated_at')
          .eq('author_id', userId)
          .order('created_at', { ascending: false });

        if (documentsError) {
          fastify.log.error({ userId, error: documentsError }, 'Failed to fetch documents');
          throw documentsError;
        }

        // 4. Fetch usage history (AI queries)
        const { data: usageHistory, error: usageError } = await supabaseAdmin
          .from('query_usage')
          .select('id, query_type, ai_model, tokens_input, tokens_output, credits_charged, metadata, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1000); // Limit to last 1000 queries to avoid huge exports

        if (usageError) {
          fastify.log.error({ userId, error: usageError }, 'Failed to fetch usage history');
          throw usageError;
        }

        // 5. Fetch templates created by the user
        const { data: templates, error: templatesError } = await supabaseAdmin
          .from('templates')
          .select('id, title, description, content, category, visibility, is_approved, created_at, updated_at')
          .eq('created_by', userId)
          .order('created_at', { ascending: false });

        if (templatesError) {
          fastify.log.error({ userId, error: templatesError }, 'Failed to fetch templates');
          throw templatesError;
        }

        // 6. Calculate usage statistics
        const totalCreditsUsed = usageHistory?.reduce((sum, query) => sum + query.credits_charged, 0) || 0;
        const totalTokensInput = usageHistory?.reduce((sum, query) => sum + (query.tokens_input || 0), 0) || 0;
        const totalTokensOutput = usageHistory?.reduce((sum, query) => sum + (query.tokens_output || 0), 0) || 0;

        // 7. Build export data structure
        const exportData = {
          export_metadata: {
            export_date: new Date().toISOString(),
            export_format: 'JSON',
            gdpr_compliance: 'Article 20 - Right to data portability',
            user_id: userId,
          },
          user_profile: {
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            role: userProfile.role,
            status: userProfile.status,
            last_active_at: userProfile.last_active_at,
            account_created_at: userProfile.created_at,
            account_updated_at: userProfile.updated_at,
          },
          tenant_information: {
            id: tenantData.id,
            subdomain: tenantData.subdomain,
            name: tenantData.name,
            tier: tenantData.tier,
            joined_at: tenantData.created_at,
          },
          documents: {
            total_count: documents?.length || 0,
            items: documents || [],
          },
          templates: {
            total_count: templates?.length || 0,
            items: templates || [],
          },
          usage_history: {
            total_queries: usageHistory?.length || 0,
            total_credits_used: totalCreditsUsed,
            total_tokens_input: totalTokensInput,
            total_tokens_output: totalTokensOutput,
            queries: usageHistory || [],
            note: usageHistory && usageHistory.length >= 1000 
              ? 'Limited to last 1000 queries. Contact support for full history.'
              : 'Complete query history included',
          },
          audit_trail: {
            export_requested_by: userId,
            export_requested_at: new Date().toISOString(),
            export_ip_address: request.ip,
            export_user_agent: request.headers['user-agent'] || 'unknown',
          },
        };

        fastify.log.info(
          {
            userId,
            tenantId,
            documentsCount: documents?.length || 0,
            templatesCount: templates?.length || 0,
            queriesCount: usageHistory?.length || 0,
          },
          'GDPR data export completed successfully'
        );

        // Set headers for file download
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="tynebase-data-export-${userId}-${Date.now()}.json"`);

        return exportData;
      } catch (error) {
        fastify.log.error(
          { userId, tenantId, error },
          'GDPR data export failed'
        );

        return reply.status(500).send({
          error: {
            code: 'EXPORT_FAILED',
            message: 'Failed to export user data',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/gdpr/delete-account
   * 
   * Initiates account deletion process for GDPR compliance (Right to be Forgotten)
   * 
   * Process:
   * 1. Validates confirmation token to prevent accidental deletion
   * 2. Marks user as deleted immediately
   * 3. Dispatches async job to anonymize/remove all user data
   * 
   * The job will:
   * - Anonymize user profile data
   * - Remove or anonymize documents
   * - Clean up embeddings and usage history
   * - Preserve audit trails as required by law
   * 
   * Security:
   * - Requires authentication
   * - Requires confirmation token matching user ID
   * - Irreversible operation
   * - Logs deletion request in audit trail
   */
  fastify.delete(
    '/api/gdpr/delete-account',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const user = (request as any).user;
      const userId = user.id;
      const tenantId = user.tenant_id;

      const DeleteAccountSchema = z.object({
        confirmation_token: z.string().min(1, 'Confirmation token is required'),
      });

      try {
        const body = DeleteAccountSchema.parse(request.body);

        fastify.log.info(
          { userId, tenantId },
          'Account deletion request received'
        );

        // Validate confirmation token (must match user ID for security)
        if (body.confirmation_token !== userId) {
          fastify.log.warn(
            { userId, providedToken: body.confirmation_token },
            'Invalid confirmation token for account deletion'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_CONFIRMATION',
              message: 'Invalid confirmation token. Please provide your user ID as confirmation.',
            },
          });
        }

        // Check if user is already marked as deleted
        const { data: existingUser, error: userCheckError } = await supabaseAdmin
          .from('users')
          .select('status')
          .eq('id', userId)
          .single();

        if (userCheckError) {
          fastify.log.error({ userId, error: userCheckError }, 'Failed to check user status');
          throw userCheckError;
        }

        if (existingUser.status === 'deleted') {
          return reply.status(400).send({
            error: {
              code: 'ALREADY_DELETED',
              message: 'Account is already marked for deletion',
            },
          });
        }

        // Mark user as deleted immediately (prevents further access)
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            status: 'deleted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          fastify.log.error({ userId, error: updateError }, 'Failed to mark user as deleted');
          throw updateError;
        }

        fastify.log.info({ userId }, 'User marked as deleted');

        // Dispatch async job to anonymize/delete user data
        const job = await dispatchJob({
          tenantId,
          type: 'gdpr_delete',
          payload: {
            user_id: userId,
            requested_at: new Date().toISOString(),
            requested_by: userId,
            ip_address: request.ip,
            user_agent: request.headers['user-agent'] || 'unknown',
          },
        });

        fastify.log.info(
          { userId, tenantId, jobId: job.id },
          'GDPR deletion job dispatched'
        );

        return reply.status(202).send({
          message: 'Account deletion initiated',
          status: 'pending',
          job_id: job.id,
          details: {
            user_marked_deleted: true,
            deletion_job_queued: true,
            estimated_completion: 'Data will be anonymized/removed within 24 hours',
          },
          note: 'Your account has been marked as deleted and you will be logged out. Data anonymization is in progress.',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
            },
          });
        }

        fastify.log.error(
          { userId, tenantId, error },
          'Account deletion failed'
        );

        return reply.status(500).send({
          error: {
            code: 'DELETION_FAILED',
            message: 'Failed to initiate account deletion',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );
}
