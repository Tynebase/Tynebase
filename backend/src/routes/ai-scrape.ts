import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { scrapeUrlToMarkdown } from '../services/ai/tavily';

const ScrapeRequestSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .refine(
      (url) => {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      },
      { message: 'Only HTTP and HTTPS protocols are allowed' }
    )
    .refine(
      (url) => {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const blockedHosts = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '::1',
          '169.254.169.254',
          'metadata.google.internal',
        ];
        
        if (blockedHosts.includes(hostname)) {
          return false;
        }
        
        if (hostname.startsWith('10.') || 
            hostname.startsWith('192.168.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          return false;
        }
        
        return true;
      },
      { message: 'URL points to a private or internal network address (SSRF protection)' }
    ),
  timeout: z.number()
    .int()
    .min(1000)
    .max(10000)
    .optional()
    .default(10000),
});

type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

/**
 * AI Scrape endpoint for extracting content from URLs
 * POST /api/ai/scrape
 */
export default async function aiScrapeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ScrapeRequest }>(
    '/api/ai/scrape',
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
        const validated = ScrapeRequestSchema.parse(request.body);

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            url: validated.url,
            timeout: validated.timeout,
          },
          'Starting URL scrape request'
        );

        const result = await scrapeUrlToMarkdown(validated.url, validated.timeout);

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            url: result.url,
            title: result.title,
            markdownLength: result.markdown.length,
          },
          'URL scrape completed successfully'
        );

        return reply.status(200).send({
          url: result.url,
          title: result.title,
          markdown: result.markdown,
          content_length: result.markdown.length,
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
            stack: error instanceof Error ? error.stack : undefined,
          },
          'Error in AI scrape endpoint'
        );

        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            return reply.status(408).send({
              error: {
                code: 'REQUEST_TIMEOUT',
                message: 'URL scraping timed out',
              },
            });
          }

          if (error.message.includes('TAVILY_API_KEY')) {
            return reply.status(500).send({
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'URL scraping service is not configured',
              },
            });
          }
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while scraping the URL',
          },
        });
      }
    }
  );
}
