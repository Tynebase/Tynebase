import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const ListRecentGenerationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
});

type ListRecentGenerationsQuery = z.infer<typeof ListRecentGenerationsQuerySchema>;

export interface GenerationJob {
  id: string;
  title: string;
  type: 'From Prompt' | 'From URL' | 'From File' | 'Enhance' | 'Template';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  document_id: string | null;
}

/**
 * Recent AI Generations listing endpoint
 * GET /api/ai/generations
 * Lists recent AI generation jobs for the tenant
 */
export default async function recentGenerationsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ListRecentGenerationsQuery }>(
    '/api/ai/generations',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      if (!tenant || !tenant.id) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Tenant context not available',
          },
        });
      }

      if (!user || !user.id) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          },
        });
      }

      try {
        const query = ListRecentGenerationsQuerySchema.parse(request.query);
        const { limit, offset, status } = query;

        // Build query for AI generation jobs
        let jobQuery = supabaseAdmin
          .from('job_queue')
          .select('id, tenant_id, type, status, payload, result, created_at, started_at, completed_at')
          .eq('tenant_id', tenant.id)
          .in('type', ['generate', 'scrape', 'enhance', 'enhance_apply', 'legal_document_upload', 'video_transcribe_to_document'])
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by status
        if (status !== 'all') {
          jobQuery = jobQuery.eq('status', status);
        }

        const { data: jobs, error: jobError } = await jobQuery;

        if (jobError) {
          request.log.error(
            {
              tenantId: tenant.id,
              error: jobError.message,
            },
            'Failed to fetch recent generations'
          );
          return reply.status(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Unable to retrieve recent generations',
            },
          });
        }

        // Get total count for pagination
        let countQuery = supabaseAdmin
          .from('job_queue')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('type', ['generate', 'scrape', 'enhance', 'enhance_apply', 'legal_document_upload', 'video_transcribe_to_document']);

        if (status !== 'all') {
          countQuery = countQuery.eq('status', status);
        }

        const { count: totalCount } = await countQuery;

        // Transform jobs for frontend
        const transformedJobs: GenerationJob[] = jobs?.map((job) => {
          const payload = job.payload as Record<string, any>;
          const result = job.result as Record<string, any> | null;
          
          // Determine generation type from job type
          let type: GenerationJob['type'] = 'From Prompt';
          if (job.type === 'scrape') {
            type = 'From URL';
          } else if (job.type === 'legal_document_upload') {
            type = 'From File';
          } else if (job.type === 'enhance' || job.type === 'enhance_apply') {
            type = 'Enhance';
          } else if (job.type === 'video_transcribe_to_document') {
            type = 'From File';
          }

          // Extract title from result or payload
          let title = result?.title || 
                      result?.document_title || 
                      payload?.original_filename || 
                      payload?.prompt?.slice(0, 50) || 
                      'Untitled Generation';
                      
          if (payload?.url && !title) {
            title = `Scraped: ${payload.url}`;
          }

          return {
            id: job.id,
            title: title.length > 50 ? title.slice(0, 50) + '...' : title,
            type,
            status: job.status,
            created_at: job.created_at,
            document_id: result?.document_id || null,
          };
        }) || [];

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            jobCount: transformedJobs.length,
          },
          'Recent generations retrieved successfully'
        );

        return reply.status(200).send({
          generations: transformedJobs,
          total: totalCount || 0,
          limit,
          offset,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: errorMessages,
            },
          });
        }

        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in recent generations endpoint'
        );

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while processing your request',
          },
        });
      }
    }
  );
}
