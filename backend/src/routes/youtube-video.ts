import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { dispatchJob } from '../utils/dispatchJob';

const YouTubeURLSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]{11}(\S*)?$/;
      return youtubeRegex.test(url);
    },
    {
      message: 'Invalid YouTube URL format. Must be a valid YouTube video URL.',
    }
  ),
});

/**
 * YouTube Video Ingestion endpoint
 * POST /api/ai/video/youtube
 * Accepts YouTube URL and dispatches processing job
 */
export default async function youtubeVideoRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/ai/video/youtube',
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
        const validationResult = YouTubeURLSchema.safeParse(request.body);

        if (!validationResult.success) {
          const errorMessages = validationResult.error.errors
            .map((e) => e.message)
            .join(', ');

          request.log.warn(
            {
              body: request.body,
              tenantId: tenant.id,
              userId: user.id,
              errors: errorMessages,
            },
            'Invalid YouTube URL submitted'
          );

          return reply.status(400).send({
            error: {
              code: 'INVALID_URL',
              message: errorMessages,
              details: validationResult.error.errors,
            },
          });
        }

        const { url } = validationResult.data;

        const sanitizedUrl = url.trim();

        request.log.info(
          {
            url: sanitizedUrl,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Dispatching YouTube video ingestion job'
        );

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'video_ingest_youtube',
          payload: {
            url: sanitizedUrl,
            user_id: user.id,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            url: sanitizedUrl,
            tenantId: tenant.id,
            userId: user.id,
          },
          'YouTube video ingestion job dispatched'
        );

        return reply.status(201).send({
          job_id: job.id,
          url: sanitizedUrl,
          status: 'queued',
        });
      } catch (error) {
        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in YouTube video endpoint'
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
