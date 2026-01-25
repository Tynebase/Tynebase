import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { ingestDocument, reIngestTenantDocuments } from '../services/rag/ingestion';
import { searchDocuments, findSimilarChunks, getEmbeddingStats } from '../services/rag/search';
import { chatWithRAGStream } from '../services/rag/chat';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Zod schema for POST /api/rag/ingest request body
 */
const ingestDocumentBodySchema = z.object({
  document_id: z.string().uuid(),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

/**
 * Zod schema for POST /api/rag/search request body
 */
const searchDocumentsBodySchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(10),
  use_reranking: z.boolean().default(true),
  rerank_top_n: z.number().int().min(1).max(50).default(10),
});

/**
 * Zod schema for GET /api/rag/similar/:chunkId path parameters
 */
const similarChunksParamsSchema = z.object({
  chunkId: z.string().uuid(),
});

/**
 * Zod schema for GET /api/rag/similar/:chunkId query parameters
 */
const similarChunksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Zod schema for POST /api/ai/chat request body
 */
const chatBodySchema = z.object({
  query: z.string().min(1).max(2000),
  max_context_chunks: z.number().int().min(1).max(20).default(10),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  stream: z.boolean().default(true),
});

/**
 * RAG routes with full middleware chain:
 * 1. rateLimitMiddleware - enforces rate limits
 * 2. tenantContextMiddleware - resolves tenant from x-tenant-subdomain header
 * 3. authMiddleware - verifies JWT and loads user
 * 4. membershipGuard - verifies user belongs to tenant
 */
export default async function ragRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/rag/ingest
   * Ingests a document by chunking and generating embeddings
   * 
   * Request Body:
   * - document_id (required): UUID of the document to ingest
   * - content (required): Document content to ingest
   * - metadata (optional): Additional metadata to attach to chunks
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' or 'editor' role
   */
  fastify.post(
    '/api/rag/ingest',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        if (user.role !== 'admin' && user.role !== 'editor') {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admin and editor roles can ingest documents',
              details: {},
            },
          });
        }

        const body = ingestDocumentBodySchema.parse(request.body);
        const { document_id, content, metadata } = body;

        const result = await ingestDocument(
          document_id,
          tenant.id,
          content,
          metadata
        );

        if (!result.success) {
          fastify.log.error(
            { error: result.error, documentId: document_id, tenantId: tenant.id },
            'Document ingestion failed'
          );
          return reply.code(500).send({
            error: {
              code: 'INGESTION_FAILED',
              message: result.error || 'Failed to ingest document',
              details: {},
            },
          });
        }

        fastify.log.info(
          { 
            documentId: document_id, 
            tenantId: tenant.id, 
            userId: user.id,
            chunksCreated: result.chunksCreated,
          },
          'Document ingested successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            documentId: result.documentId,
            chunksCreated: result.chunksCreated,
            embeddingsGenerated: result.embeddingsGenerated,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/rag/ingest');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * POST /api/rag/search
   * Performs hybrid search with optional reranking
   * 
   * Request Body:
   * - query (required): Search query (1-1000 characters)
   * - limit (optional): Maximum number of results (default: 10, max: 100)
   * - use_reranking (optional): Enable Cohere reranking (default: true)
   * - rerank_top_n (optional): Number of results to rerank (default: 10, max: 50)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.post(
    '/api/rag/search',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const body = searchDocumentsBodySchema.parse(request.body);
        const { query, limit, use_reranking, rerank_top_n } = body;

        const results = await searchDocuments({
          tenantId: tenant.id,
          query,
          limit,
          useReranking: use_reranking,
          rerankTopN: rerank_top_n,
        });

        fastify.log.info(
          { 
            tenantId: tenant.id, 
            userId: user.id,
            query,
            resultsCount: results.length,
            useReranking: use_reranking,
          },
          'Search completed successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            results,
            count: results.length,
            query,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/rag/search');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * GET /api/rag/similar/:chunkId
   * Finds similar chunks to a given chunk
   * 
   * Path Parameters:
   * - chunkId: UUID of the chunk to find similar content for
   * 
   * Query Parameters:
   * - limit (optional): Maximum number of results (default: 10, max: 50)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.get(
    '/api/rag/similar/:chunkId',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const params = similarChunksParamsSchema.parse(request.params);
        const query = similarChunksQuerySchema.parse(request.query);
        const { chunkId } = params;
        const { limit } = query;

        const results = await findSimilarChunks(chunkId, tenant.id, limit);

        fastify.log.info(
          { 
            tenantId: tenant.id, 
            userId: user.id,
            chunkId,
            resultsCount: results.length,
          },
          'Similar chunks found successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            results,
            count: results.length,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/rag/similar/:chunkId');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * GET /api/rag/stats
   * Gets embedding statistics for the tenant
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.get(
    '/api/rag/stats',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const stats = await getEmbeddingStats(tenant.id);

        fastify.log.info(
          { 
            tenantId: tenant.id, 
            userId: user.id,
            stats,
          },
          'Embedding stats retrieved successfully'
        );

        return reply.code(200).send({
          success: true,
          data: stats,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/rag/stats');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * POST /api/rag/reingest
   * Re-ingests all published documents for the tenant
   * Useful after embedding model changes
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' role
   */
  fastify.post(
    '/api/rag/reingest',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        if (user.role !== 'admin') {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admin role can trigger re-ingestion',
              details: {},
            },
          });
        }

        const results = await reIngestTenantDocuments(tenant.id);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        fastify.log.info(
          { 
            tenantId: tenant.id, 
            userId: user.id,
            totalDocuments: results.length,
            successCount,
            failureCount,
          },
          'Tenant re-ingestion completed'
        );

        return reply.code(200).send({
          success: true,
          data: {
            totalDocuments: results.length,
            successCount,
            failureCount,
            results,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/rag/reingest');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * GET /api/sources/health
   * Returns indexing health statistics for the tenant
   * 
   * Response:
   * - total_documents: Total number of documents
   * - indexed_documents: Documents with last_indexed_at set
   * - outdated_documents: Documents where updated_at > last_indexed_at
   * - failed_jobs: Count of failed rag_index jobs
   * - documents_needing_reindex: List of document IDs that need re-indexing
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.get(
    '/api/sources/health',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Count total documents
        const { count: totalDocuments, error: totalError } = await supabaseAdmin
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        if (totalError) {
          fastify.log.error(
            { error: totalError, tenantId: tenant.id },
            'Failed to count total documents'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve document statistics',
              details: {},
            },
          });
        }

        // Count indexed documents (last_indexed_at IS NOT NULL)
        const { count: indexedDocuments, error: indexedError } = await supabaseAdmin
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .not('last_indexed_at', 'is', null);

        if (indexedError) {
          fastify.log.error(
            { error: indexedError, tenantId: tenant.id },
            'Failed to count indexed documents'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve indexed document statistics',
              details: {},
            },
          });
        }

        // Find outdated documents (updated_at > last_indexed_at)
        // Fetch all indexed documents and filter in code since Supabase JS doesn't support column-to-column comparison
        const { data: allIndexedDocs, error: allIndexedError } = await supabaseAdmin
          .from('documents')
          .select('id, title, updated_at, last_indexed_at')
          .eq('tenant_id', tenant.id)
          .not('last_indexed_at', 'is', null);

        if (allIndexedError) {
          fastify.log.error(
            { error: allIndexedError, tenantId: tenant.id },
            'Failed to query indexed documents for outdated check'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve outdated document statistics',
              details: {},
            },
          });
        }

        // Filter outdated documents where updated_at > last_indexed_at
        const outdatedDocs = (allIndexedDocs || []).filter(doc => 
          new Date(doc.updated_at) > new Date(doc.last_indexed_at)
        );

        // Count failed rag_index jobs
        const { count: failedJobs, error: failedJobsError } = await supabaseAdmin
          .from('job_queue')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('type', 'rag_index')
          .eq('status', 'failed');

        if (failedJobsError) {
          fastify.log.error(
            { error: failedJobsError, tenantId: tenant.id },
            'Failed to count failed jobs'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve failed job statistics',
              details: {},
            },
          });
        }

        // Get documents that have never been indexed
        const { data: neverIndexedDocs, error: neverIndexedError } = await supabaseAdmin
          .from('documents')
          .select('id, title, created_at')
          .eq('tenant_id', tenant.id)
          .is('last_indexed_at', null);

        if (neverIndexedError) {
          fastify.log.error(
            { error: neverIndexedError, tenantId: tenant.id },
            'Failed to query never-indexed documents'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve never-indexed document statistics',
              details: {},
            },
          });
        }

        // Combine outdated and never-indexed documents
        const documentsNeedingReindex = [
          ...(neverIndexedDocs || []).map(doc => ({
            id: doc.id,
            title: doc.title,
            reason: 'never_indexed' as const,
            last_indexed_at: null,
            updated_at: doc.created_at,
          })),
          ...(outdatedDocs || []).map(doc => ({
            id: doc.id,
            title: doc.title,
            reason: 'outdated' as const,
            last_indexed_at: doc.last_indexed_at,
            updated_at: doc.updated_at,
          })),
        ];

        const stats = {
          total_documents: totalDocuments || 0,
          indexed_documents: indexedDocuments || 0,
          outdated_documents: (outdatedDocs || []).length,
          never_indexed_documents: (neverIndexedDocs || []).length,
          failed_jobs: failedJobs || 0,
          documents_needing_reindex: documentsNeedingReindex,
        };

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            stats: {
              total: stats.total_documents,
              indexed: stats.indexed_documents,
              outdated: stats.outdated_documents,
              neverIndexed: stats.never_indexed_documents,
              failedJobs: stats.failed_jobs,
              needingReindex: documentsNeedingReindex.length,
            },
          },
          'Index health stats retrieved successfully'
        );

        return reply.code(200).send({
          success: true,
          data: stats,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/sources/health');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * POST /api/ai/chat
   * RAG-powered chat endpoint with streaming support
   * 
   * Request Body:
   * - query (required): User's question (1-2000 characters)
   * - max_context_chunks (optional): Number of context chunks to use (default: 10, max: 20)
   * - model (optional): AI model to use
   * - temperature (optional): Temperature for generation (default: 0.7)
   * - stream (optional): Enable streaming response (default: true)
   * 
   * Flow:
   * 1. Check knowledge_indexing consent
   * 2. Deduct 1 credit
   * 3. Embed query (OpenAI EU)
   * 4. Call hybrid_search RPC (top 50 chunks)
   * 5. Call AWS Bedrock Cohere Rerank (top 10 chunks)
   * 6. Build prompt with context
   * 7. Stream response from LLM
   * 8. Log query_usage
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have knowledge_indexing consent enabled
   * 
   * Rate Limit: 10 requests per minute
   */
  fastify.post(
    '/api/ai/chat',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const body = chatBodySchema.parse(request.body);
        const { query, max_context_chunks, model, temperature, stream } = body;

        // Step 1: Check knowledge_indexing consent
        const { data: consent, error: consentError } = await supabaseAdmin
          .from('user_consents')
          .select('knowledge_indexing')
          .eq('user_id', user.id)
          .single();

        if (consentError || !consent || !consent.knowledge_indexing) {
          fastify.log.warn(
            { userId: user.id, tenantId: tenant.id },
            'RAG chat blocked: knowledge_indexing consent not granted'
          );
          return reply.code(403).send({
            error: {
              code: 'CONSENT_REQUIRED',
              message: 'Knowledge indexing consent is required to use RAG chat',
              details: {
                consent_type: 'knowledge_indexing',
              },
            },
          });
        }

        // Step 2: Deduct 1 credit
        const currentMonth = new Date().toISOString().slice(0, 7);
        const creditsToDeduct = 1;

        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
          'deduct_credits',
          {
            p_tenant_id: tenant.id,
            p_credits: creditsToDeduct,
            p_month_year: currentMonth,
          }
        );

        if (deductError) {
          fastify.log.error(
            { error: deductError, tenantId: tenant.id },
            'Credit deduction failed for RAG chat'
          );
          return reply.code(500).send({
            error: {
              code: 'CREDIT_DEDUCTION_FAILED',
              message: 'Unable to deduct credits for this operation',
              details: {},
            },
          });
        }

        if (!deductResult || deductResult.success === false) {
          const errorMessage = deductResult?.error_message || 'Insufficient credits';
          fastify.log.warn(
            { tenantId: tenant.id, userId: user.id, errorMessage },
            'Credit deduction rejected for RAG chat'
          );
          return reply.code(403).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: errorMessage,
              details: {
                credits_required: creditsToDeduct,
              },
            },
          });
        }

        // Step 3-7: Execute RAG pipeline with streaming
        if (stream) {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          try {
            const chatStream = chatWithRAGStream({
              tenantId: tenant.id,
              userId: user.id,
              query,
              maxContextChunks: max_context_chunks,
              model,
              temperature,
              stream: true,
            });

            // Iterate through the generator
            let result = await chatStream.next();
            while (!result.done) {
              // Yield text chunks
              reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: result.value })}\n\n`);
              result = await chatStream.next();
            }

            // result.value now contains the final ChatResponse
            const finalResponse = result.value;
            if (finalResponse) {
              // Send citations
              reply.raw.write(`data: ${JSON.stringify({ 
                type: 'citations', 
                citations: finalResponse.citations.map((c: any) => ({
                  documentId: c.documentId,
                  chunkIndex: c.chunkIndex,
                  content: c.chunkContent,
                  metadata: c.metadata,
                }))
              })}\n\n`);

              // Step 8: Log query_usage
              await supabaseAdmin.from('query_usage').insert({
                tenant_id: tenant.id,
                user_id: user.id,
                query_type: 'rag_chat',
                query_text: query,
                ai_model: finalResponse.model,
                tokens_input: finalResponse.tokensInput,
                tokens_output: finalResponse.tokensOutput,
                credits_charged: creditsToDeduct,
                metadata: {
                  context_chunks: max_context_chunks,
                  citations_count: finalResponse.citations.length,
                },
              });

              fastify.log.info(
                {
                  tenantId: tenant.id,
                  userId: user.id,
                  query,
                  model: finalResponse.model,
                  tokensInput: finalResponse.tokensInput,
                  tokensOutput: finalResponse.tokensOutput,
                  creditsCharged: creditsToDeduct,
                  citationsCount: finalResponse.citations.length,
                },
                'RAG chat completed successfully'
              );
            }

            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
          } catch (streamError: any) {
            fastify.log.error({ error: streamError }, 'Error during RAG chat streaming');
            reply.raw.write(`data: ${JSON.stringify({ 
              type: 'error', 
              error: streamError.message || 'Streaming failed' 
            })}\n\n`);
            reply.raw.end();
          }
        } else {
          // Non-streaming response (for testing/debugging)
          const { chatWithRAG } = await import('../services/rag/chat');
          const chatResponse = await chatWithRAG({
            tenantId: tenant.id,
            userId: user.id,
            query,
            maxContextChunks: max_context_chunks,
            model,
            temperature,
            stream: false,
          });

          // Step 8: Log query_usage
          await supabaseAdmin.from('query_usage').insert({
            tenant_id: tenant.id,
            user_id: user.id,
            query_type: 'rag_chat',
            query_text: query,
            ai_model: chatResponse.model,
            tokens_input: chatResponse.tokensInput,
            tokens_output: chatResponse.tokensOutput,
            credits_charged: creditsToDeduct,
            metadata: {
              context_chunks: max_context_chunks,
              citations_count: chatResponse.citations.length,
            },
          });

          fastify.log.info(
            {
              tenantId: tenant.id,
              userId: user.id,
              query,
              model: chatResponse.model,
              tokensInput: chatResponse.tokensInput,
              tokensOutput: chatResponse.tokensOutput,
              creditsCharged: creditsToDeduct,
              citationsCount: chatResponse.citations.length,
            },
            'RAG chat completed successfully (non-streaming)'
          );

          return reply.code(200).send({
            success: true,
            data: {
              answer: chatResponse.answer,
              citations: chatResponse.citations.map(c => ({
                documentId: c.documentId,
                chunkIndex: c.chunkIndex,
                content: c.chunkContent,
                metadata: c.metadata,
              })),
              model: chatResponse.model,
              tokensUsed: chatResponse.tokensInput + chatResponse.tokensOutput,
              creditsUsed: creditsToDeduct,
            },
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/ai/chat');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );
}
