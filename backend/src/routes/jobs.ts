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
          .select('id, tenant_id, type, status, result, created_at, started_at, completed_at')
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

        const jobData: any = {
          id: job.id,
          type: job.type,
          status: job.status,
          created_at: job.created_at,
          progress: 0, // Default progress
        };

        // Set progress based on status and time elapsed
        if (job.status === 'pending') {
          jobData.progress = 0;
        } else if (job.status === 'processing') {
          // Calculate progress based on time elapsed (more granular)
          const startedAt = new Date(job.started_at || job.created_at).getTime();
          const now = Date.now();
          const elapsed = now - startedAt;
          
          // Estimate: AI generation typically takes 5-15 seconds
          // Progress curve: 10% -> 30% -> 60% -> 90% over ~10 seconds
          if (elapsed < 2000) {
            jobData.progress = 10;
          } else if (elapsed < 4000) {
            jobData.progress = 30;
          } else if (elapsed < 7000) {
            jobData.progress = 60;
          } else if (elapsed < 10000) {
            jobData.progress = 80;
          } else {
            jobData.progress = 90;
          }
        } else if (job.status === 'completed') {
          jobData.progress = 100;
        } else if (job.status === 'failed') {
          jobData.progress = 0;
        }

        if (job.status === 'completed' && job.result) {
          jobData.result = job.result;
          jobData.completed_at = job.completed_at;
        }

        if (job.status === 'failed' && job.result) {
          jobData.error_message = job.result.error || 'Job processing failed';
          jobData.completed_at = job.completed_at;
        }

        return reply.status(200).send({ job: jobData });
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

  /**
   * Delete a job from the queue
   * DELETE /api/jobs/:id
   */
  fastify.delete<{ Params: JobIdParams }>(
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

        // First, fetch the job to verify ownership and status
        const { data: job, error: jobError } = await supabaseAdmin
          .from('job_queue')
          .select('id, tenant_id, status')
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
              'Job not found for deletion'
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
            'Failed to fetch job for deletion'
          );
          return reply.status(500).send({
            error: {
              code: 'JOB_FETCH_FAILED',
              message: 'Unable to retrieve job for deletion',
            },
          });
        }

        // Verify tenant ownership
        if (job.tenant_id !== tenant.id) {
          request.log.warn(
            {
              jobId,
              jobTenantId: job.tenant_id,
              requestTenantId: tenant.id,
              userId: user.id,
            },
            'Unauthorized job deletion attempt'
          );
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to delete this job',
            },
          });
        }

        // Cannot delete jobs that are currently processing
        if (job.status === 'processing') {
          request.log.warn(
            {
              jobId,
              tenantId: tenant.id,
              userId: user.id,
              status: job.status,
            },
            'Cannot delete processing job'
          );
          return reply.status(409).send({
            error: {
              code: 'JOB_CANNOT_DELETE',
              message: 'Cannot delete a job that is currently processing',
            },
          });
        }

        // Delete the job
        const { error: deleteError } = await supabaseAdmin
          .from('job_queue')
          .delete()
          .eq('id', jobId);

        if (deleteError) {
          request.log.error(
            {
              jobId,
              tenantId: tenant.id,
              error: deleteError.message,
            },
            'Failed to delete job'
          );
          return reply.status(500).send({
            error: {
              code: 'JOB_DELETE_FAILED',
              message: 'Failed to delete the job',
            },
          });
        }

        request.log.info(
          {
            jobId,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Job deleted successfully'
        );

        return reply.status(200).send({
          message: 'Job deleted successfully',
          jobId: jobId,
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
          'Error in job deletion endpoint'
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
