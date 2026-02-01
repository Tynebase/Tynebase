import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const ListMediaJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(['video', 'audio', 'all']).default('all'),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
});

type ListMediaJobsQuery = z.infer<typeof ListMediaJobsQuerySchema>;

/**
 * Media Jobs listing endpoint
 * GET /api/ai/media/jobs
 * Lists recent video/audio ingestion jobs for the tenant
 */
export default async function mediaJobsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ListMediaJobsQuery }>(
    '/api/ai/media/jobs',
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
        const query = ListMediaJobsQuerySchema.parse(request.query);
        const { limit, offset, type, status } = query;

        // Build query for media ingestion jobs
        let jobQuery = supabaseAdmin
          .from('job_queue')
          .select('id, tenant_id, type, status, payload, result, created_at, started_at, completed_at')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Filter by job type
        if (type === 'video') {
          jobQuery = jobQuery.in('type', ['video_ingestion', 'video_ingest_youtube', 'video_ingest']);
        } else if (type === 'audio') {
          jobQuery = jobQuery.in('type', ['audio_ingestion', 'audio_ingest']);
        } else {
          // All media jobs
          jobQuery = jobQuery.in('type', [
            'video_ingestion', 'video_ingest_youtube', 'video_ingest',
            'audio_ingestion', 'audio_ingest'
          ]);
        }

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
            'Failed to fetch media jobs'
          );
          return reply.status(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Unable to retrieve media jobs',
            },
          });
        }

        // Get total count for pagination
        let countQuery = supabaseAdmin
          .from('job_queue')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        if (type === 'video') {
          countQuery = countQuery.in('type', ['video_ingestion', 'video_ingest_youtube', 'video_ingest']);
        } else if (type === 'audio') {
          countQuery = countQuery.in('type', ['audio_ingestion', 'audio_ingest']);
        } else {
          countQuery = countQuery.in('type', [
            'video_ingestion', 'video_ingest_youtube', 'video_ingest',
            'audio_ingestion', 'audio_ingest'
          ]);
        }

        if (status !== 'all') {
          countQuery = countQuery.eq('status', status);
        }

        const { count: totalCount } = await countQuery;

        // Transform jobs for frontend
        const transformedJobs = jobs?.map((job) => {
          const payload = job.payload as Record<string, any>;
          const result = job.result as Record<string, any> | null;
          
          // Determine media type from job type
          const isVideo = ['video_ingestion', 'video_ingest_youtube', 'video_ingest'].includes(job.type);
          const isYouTube = job.type === 'video_ingest_youtube' || payload?.youtube_url || payload?.url;
          
          // Extract title from result or payload
          let title = result?.title || payload?.original_filename || 'Untitled Media';
          if (isYouTube && !result?.title) {
            title = payload?.url || payload?.youtube_url || 'YouTube Video';
          }

          // Calculate duration string
          let duration = '';
          if (result?.duration_minutes) {
            const mins = Math.floor(result.duration_minutes);
            const secs = Math.round((result.duration_minutes - mins) * 60);
            duration = `${mins}:${secs.toString().padStart(2, '0')}`;
          }

          return {
            id: job.id,
            title,
            media_type: isVideo ? 'video' : 'audio',
            source: isYouTube ? 'youtube' : (payload?.storage_path ? 'upload' : 'url'),
            status: job.status,
            duration,
            word_count: result?.transcript_length ? Math.round(result.transcript_length / 5) : null,
            document_id: result?.document_id || null,
            credits_used: result?.credits_used || null,
            created_at: job.created_at,
            started_at: job.started_at,
            completed_at: job.completed_at,
          };
        }) || [];

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            jobCount: transformedJobs.length,
          },
          'Media jobs retrieved successfully'
        );

        return reply.status(200).send({
          jobs: transformedJobs,
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
          'Error in media jobs endpoint'
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
