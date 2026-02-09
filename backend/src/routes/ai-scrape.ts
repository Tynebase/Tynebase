import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { creditGuardMiddleware } from '../middleware/creditGuard';
import { scrapeUrlToMarkdown } from '../services/ai/tavily';
import { generateText } from '../services/ai/generation';
import { supabaseAdmin } from '../lib/supabase';
import { getModelCreditCost } from '../utils/creditCalculator';
import type { AIModel } from '../services/ai/types';

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
          'localhost', '127.0.0.1', '0.0.0.0', '::1',
          '169.254.169.254', 'metadata.google.internal',
        ];
        if (blockedHosts.includes(hostname)) return false;
        if (hostname.startsWith('10.') || 
            hostname.startsWith('192.168.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          return false;
        }
        return true;
      },
      { message: 'URL points to a private or internal network address (SSRF protection)' }
    ),
  output_types: z.array(
    z.enum(['full_article', 'summary', 'outline', 'raw'])
  ).min(1).max(4).optional().default(['full_article']),
  ai_model: z.enum(['deepseek', 'claude', 'gemini'])
    .optional()
    .default('deepseek'),
  timeout: z.number().int().min(1000).max(30000).optional().default(15000),
});

type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

const SCRAPE_BASE_CREDITS = 3;

function getPromptForOutputType(outputType: string, content: string, title: string): string {
  switch (outputType) {
    case 'summary':
      return `Analyze the following web content and create a comprehensive summary that extracts the key knowledge, insights, and takeaways.

DO NOT just list bullet points. Instead:
- Identify the main topics and themes discussed
- Extract key insights, facts, and actionable information
- Organize into clear sections grouped by topic
- Include any important quotes or statistics mentioned
- Highlight practical takeaways the reader should remember

Source: ${title}

Content:
${content.substring(0, 80000)}

Generate a well-organized summary with clear headings:`;
    
    case 'outline':
      return `Analyze the following web content and create a structured outline that captures the hierarchy of information.

Create:
- Main topics as top-level headings
- Sub-topics as nested points
- Key details under each sub-topic
- Cross-references where topics relate

Source: ${title}

Content:
${content.substring(0, 80000)}

Generate a comprehensive hierarchical outline:`;
    
    case 'full_article':
    default:
      return `Transform the following web content into a well-written, professional article.

Requirements:
- Create a compelling introduction that hooks the reader
- Organize content into logical sections with clear headings
- Write in a professional but accessible tone
- Expand on key points with context and explanation
- Include a conclusion that summarizes the main takeaways
- Use proper Markdown formatting (## for headings, **bold** for emphasis, etc.)
- Remove navigation elements, ads, and other non-content
- Preserve all important information from the original

Source: ${title}

Content:
${content.substring(0, 80000)}

Write a polished, publication-ready article:`;
  }
}

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
        creditGuardMiddleware,
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

        // Calculate credits: 3 base + AI model cost × number of AI outputs
        const aiModelCost = getModelCreditCost(validated.ai_model);
        const aiOutputCount = validated.output_types.filter(t => t !== 'raw').length;
        const totalCredits = SCRAPE_BASE_CREDITS + (aiModelCost * aiOutputCount);

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            url: validated.url,
            outputTypes: validated.output_types,
            aiModel: validated.ai_model,
            credits: totalCredits,
          },
          'Starting URL scrape request'
        );

        // Step 1: Deduct credits
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
          'deduct_credits',
          {
            p_tenant_id: tenant.id,
            p_credits: totalCredits,
            p_month_year: currentMonth,
          }
        );

        if (deductError) {
          request.log.error(
            { tenantId: tenant.id, error: deductError.message },
            'Failed to deduct credits'
          );
          return reply.status(500).send({
            error: {
              code: 'CREDIT_DEDUCTION_FAILED',
              message: 'Unable to deduct credits for this operation',
            },
          });
        }

        if (!deductResult || deductResult.length === 0 || !deductResult[0].success) {
          const errorMessage = deductResult?.[0]?.error_message || 'Insufficient credits';
          return reply.status(403).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: errorMessage,
            },
          });
        }

        // Step 2: Scrape the URL with Tavily
        const scrapeResult = await scrapeUrlToMarkdown(validated.url, validated.timeout);

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            url: scrapeResult.url,
            title: scrapeResult.title,
            markdownLength: scrapeResult.markdown.length,
          },
          'URL scrape completed with Tavily'
        );

        const modelMapping: Record<string, AIModel> = {
          deepseek: 'deepseek-v3',
          gemini: 'gemini-2.5-flash',
          claude: 'claude-sonnet-4.5',
        };

        // Step 3: Process with AI for each output type, save documents
        const documentIds: string[] = [];
        let firstMarkdown = scrapeResult.markdown;
        let totalTokensUsed = 0;
        const isOnlyRaw = validated.output_types.length === 1 && validated.output_types[0] === 'raw';

        const OUTPUT_TYPE_LABELS: Record<string, string> = {
          full_article: 'Article',
          summary: 'Summary',
          outline: 'Outline',
          raw: 'Raw',
        };

        for (const outputType of validated.output_types) {
          let content: string;

          if (outputType === 'raw') {
            content = scrapeResult.markdown;
          } else {
            const prompt = getPromptForOutputType(
              outputType,
              scrapeResult.markdown,
              scrapeResult.title
            );

            request.log.info(
              { tenantId: tenant.id, aiModel: validated.ai_model, outputType },
              'Processing scraped content with AI'
            );

            const aiResponse = await generateText({
              prompt,
              model: modelMapping[validated.ai_model],
              maxTokens: 4000,
              systemPrompt: 'You are a professional document writer. Generate the requested content IMMEDIATELY and IN FULL. Do NOT ask clarifying questions or engage in conversation. Do NOT include meta-commentary like "Here is your document". Just output the content directly using proper Markdown formatting.',
            });

            content = aiResponse.content;
            totalTokensUsed += (aiResponse.tokensInput || 0) + (aiResponse.tokensOutput || 0);
          }

          // Save first result for preview
          if (documentIds.length === 0) {
            firstMarkdown = content;
          }

          // Save as document unless it's the only output and it's raw (preserve preview behavior)
          if (!isOnlyRaw) {
            const docTitle = validated.output_types.length > 1
              ? `${scrapeResult.title || 'Scraped Content'} — ${OUTPUT_TYPE_LABELS[outputType] || outputType}`
              : scrapeResult.title || 'Scraped Content';

            const { data: doc, error: docError } = await supabaseAdmin
              .from('documents')
              .insert({
                tenant_id: tenant.id,
                title: docTitle,
                content,
                status: 'draft',
                author_id: user.id,
              })
              .select()
              .single();

            if (!docError && doc) {
              documentIds.push(doc.id);
              request.log.info(
                { documentId: doc.id, outputType },
                'Document created from scraped content'
              );
            }
          }
        }

        request.log.info(
          { tenantId: tenant.id, totalTokensUsed, documentsCreated: documentIds.length },
          'Scrape processing completed'
        );

        // Step 4: Log usage
        await supabaseAdmin.from('query_usage').insert({
          tenant_id: tenant.id,
          user_id: user.id,
          query_type: 'url_scrape',
          ai_model: validated.ai_model,
          tokens_input: totalTokensUsed,
          tokens_output: 0,
          credits_charged: totalCredits,
          metadata: {
            url: validated.url,
            output_types: validated.output_types,
            scraped_title: scrapeResult.title,
            scraped_length: scrapeResult.markdown.length,
            document_ids: documentIds,
            credit_breakdown: {
              base: SCRAPE_BASE_CREDITS,
              ai_per_output: aiModelCost,
              ai_output_count: aiOutputCount,
              total: totalCredits,
            },
          },
        });

        return reply.status(200).send({
          success: true,
          data: {
            url: scrapeResult.url,
            title: scrapeResult.title,
            markdown: firstMarkdown,
            raw_markdown: scrapeResult.markdown,
            output_types: validated.output_types,
            ai_model: validated.ai_model,
            content_length: firstMarkdown.length,
            credits_charged: totalCredits,
            tokens_used: totalTokensUsed,
            document_ids: documentIds,
            document_id: documentIds[0] || null,
          },
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
