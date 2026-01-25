import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const JobIdParamsSchema = z.object({
  id: z.string().uuid('Invalid job ID format'),
});

type JobIdParams = z.infer<typeof JobIdParamsSchema>;

/**
 * Job status polling endpoint
 * GET /api/jobs/:id
 */
export default async function jobRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: JobIdParams }>(
    '/api/jobs/:id',
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
        const validated = JobIdParamsSchema.parse(request.params);
        const jobId = validated.id;

        const { data: job, error: jobError } = await supabaseAdmin
          .from('job_queue')
          .select('id, tenant_id, type, status, result, created_at, completed_at')
          .eq('id', jobId)
          .single();

        if (jobError) {
          if (jobError.code === 'PGRST116') {
            request.log.warn(
              {
                jobId,
                tenantId: tenant.id,
                userId: user.id,
              },
              'Job not found'
            );
            return reply.status(404).send({
              error: {
                code: 'JOB_NOT_FOUND',
                message: 'The requested job does not exist',
              },
            });
          }

          request.log.error(
            {
              jobId,
              tenantId: tenant.id,
              error: jobError.message,
            },
            'Failed to fetch job'
          );
          return reply.status(500).send({
            error: {
              code: 'JOB_FETCH_FAILED',
              message: 'Unable to retrieve job status',
            },
          });
        }

        if (job.tenant_id !== tenant.id) {
          request.log.warn(
            {
              jobId,
              jobTenantId: job.tenant_id,
              requestTenantId: tenant.id,
              userId: user.id,
            },
            'Unauthorized job access attempt'
          );
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to access this job',
            },
          });
        }

        request.log.info(
          {
            jobId,
            tenantId: tenant.id,
            userId: user.id,
            status: job.status,
          },
          'Job status retrieved successfully'
        );

        const response: any = {
          id: job.id,
          type: job.type,
          status: job.status,
          created_at: job.created_at,
        };

        if (job.status === 'completed' && job.result) {
          response.result = job.result;
          response.completed_at = job.completed_at;
        }

        if (job.status === 'failed' && job.result) {
          response.error = job.result.error || 'Job processing failed';
          response.completed_at = job.completed_at;
        }

        return reply.status(200).send(response);
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
          'Error in job status endpoint'
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
