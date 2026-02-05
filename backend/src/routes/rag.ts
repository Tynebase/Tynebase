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
import { getModelCreditCost } from '../utils/creditCalculator';

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
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
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
   * POST /api/sources/:id/reindex
   * Manually triggers re-indexing for a specific document
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' role
   * 
   * Security:
   * - Admin only to prevent spam re-indexing
   * - Checks for existing pending/processing jobs to prevent duplicates
   * - Enforces tenant isolation
   * - Validates document exists and belongs to tenant
   * 
   * Behavior:
   * - Dispatches rag_index job for the document
   * - Skips if job already pending/processing
   * - Returns job ID for tracking
   */
  fastify.post(
    '/api/sources/:id/reindex',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate path parameters
        const paramsSchema = z.object({
          id: z.string().uuid(),
        });
        const params = paramsSchema.parse(request.params);
        const { id: documentId } = params;

        // Check user has admin permission
        if (user.role !== 'admin') {
          fastify.log.warn(
            { documentId, userId: user.id, userRole: user.role, tenantId: tenant.id },
            'User attempted to trigger re-index without admin permission'
          );
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admin users can trigger manual re-indexing',
              details: {},
            },
          });
        }

        // Verify document exists and belongs to tenant
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, title, tenant_id')
          .eq('id', documentId)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError) {
          if (docError.code === 'PGRST116') {
            fastify.log.warn(
              { documentId, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied for re-index'
            );
            return reply.code(404).send({
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'Document not found',
                details: {},
              },
            });
          }

          fastify.log.error(
            { error: docError, documentId, tenantId: tenant.id, userId: user.id },
            'Failed to fetch document for re-index'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to verify document',
              details: {},
            },
          });
        }

        // Check for existing pending or processing rag_index jobs for this document
        const { data: existingJobs, error: jobCheckError } = await supabaseAdmin
          .from('job_queue')
          .select('id, status, created_at')
          .eq('tenant_id', tenant.id)
          .eq('type', 'rag_index')
          .in('status', ['pending', 'processing'])
          .eq('payload->>document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (jobCheckError) {
          fastify.log.error(
            { error: jobCheckError, documentId, tenantId: tenant.id },
            'Failed to check for existing rag_index jobs'
          );
          return reply.code(500).send({
            error: {
              code: 'JOB_CHECK_FAILED',
              message: 'Failed to check for existing indexing jobs',
              details: {},
            },
          });
        }

        // If job already exists, return existing job info
        if (existingJobs && existingJobs.length > 0) {
          const existingJob = existingJobs[0];
          fastify.log.info(
            { documentId, existingJobId: existingJob.id, status: existingJob.status, tenantId: tenant.id },
            'Re-index skipped - job already pending/processing'
          );
          return reply.code(200).send({
            success: true,
            data: {
              message: 'Re-index job already queued',
              job_id: existingJob.id,
              status: existingJob.status,
              document_id: documentId,
              document_title: document.title,
            },
          });
        }

        // Dispatch new rag_index job
        const { dispatchJob } = await import('../utils/dispatchJob');
        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'rag_index',
          payload: { document_id: documentId }
        });

        fastify.log.info(
          { 
            documentId, 
            documentTitle: document.title,
            jobId: job.id, 
            tenantId: tenant.id, 
            userId: user.id 
          },
          'Manual re-index job dispatched successfully'
        );

        return reply.code(201).send({
          success: true,
          data: {
            message: 'Re-index job queued successfully',
            job_id: job.id,
            status: job.status,
            document_id: documentId,
            document_title: document.title,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID format',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/sources/:id/reindex');
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
        const { query, history, max_context_chunks, model, temperature, stream } = body;

        // Step 1: Check knowledge_indexing consent
        const { data: consent, error: consentError } = await supabaseAdmin
          .from('user_consents')
          .select('knowledge_indexing')
          .eq('user_id', user.id)
          .single();

        // Default to true if no consent record exists (new users)
        // Only block if consent record exists AND knowledge_indexing is explicitly false
        const hasConsent = consentError?.code === 'PGRST116' ? true : (consent?.knowledge_indexing ?? true);
        
        if (!hasConsent) {
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

        // Step 2: Deduct credits based on model (default: deepseek = 1 credit)
        const currentMonth = new Date().toISOString().slice(0, 7);
        const creditsToDeduct = getModelCreditCost(model || 'deepseek');

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
          // Get origin from request for CORS
          const origin = request.headers.origin || 'http://localhost:3000';
          
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          });

          try {
            const chatStream = chatWithRAGStream({
              tenantId: tenant.id,
              userId: user.id,
              query,
              history,
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
                  rerankScore: c.rerankScore,
                  similarityScore: c.similarityScore,
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
            const errorMessage = streamError?.message || streamError?.toString() || 'Unknown streaming error';
            const errorStack = streamError?.stack || '';
            fastify.log.error({ 
              error: errorMessage,
              stack: errorStack,
              name: streamError?.name,
              code: streamError?.code,
            }, 'Error during RAG chat streaming');
            reply.raw.write(`data: ${JSON.stringify({ 
              type: 'error', 
              error: errorMessage
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

  /**
   * GET /api/sources
   * Lists all documents for the tenant with their indexing status
   * 
   * Query Parameters:
   * - page (optional): Page number (default: 1)
   * - limit (optional): Results per page (default: 20, max: 100)
   * - status (optional): Filter by indexing status ('indexed', 'pending', 'outdated', 'failed')
   * - search (optional): Search by title
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.get(
    '/api/sources',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const querySchema = z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          status: z.enum(['indexed', 'pending', 'outdated', 'failed']).optional(),
          search: z.string().optional(),
        });

        const query = querySchema.parse(request.query);
        const { page, limit, status, search } = query;
        const offset = (page - 1) * limit;

        // Build base query for documents
        let docsQuery = supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            status,
            created_at,
            updated_at,
            last_indexed_at,
            author_id,
            users:author_id (
              id,
              email,
              full_name
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false });

        // Apply search filter
        if (search) {
          docsQuery = docsQuery.ilike('title', `%${search}%`);
        }

        // Fetch documents
        const { data: documents, error: docsError, count } = await docsQuery
          .range(offset, offset + limit - 1);

        if (docsError) {
          fastify.log.error(
            { error: docsError, tenantId: tenant.id },
            'Failed to fetch documents for sources list'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to retrieve sources',
              details: {},
            },
          });
        }

        // Get chunk counts for each document
        const docIds = (documents || []).map((d: any) => d.id);
        const { data: chunkCounts, error: chunkError } = await supabaseAdmin
          .from('document_chunks')
          .select('document_id')
          .in('document_id', docIds.length > 0 ? docIds : ['00000000-0000-0000-0000-000000000000']);

        const chunkCountMap: Record<string, number> = {};
        if (!chunkError && chunkCounts) {
          chunkCounts.forEach((chunk: { document_id: string }) => {
            chunkCountMap[chunk.document_id] = (chunkCountMap[chunk.document_id] || 0) + 1;
          });
        }

        // Get failed job counts
        const { data: failedJobs, error: failedJobsError } = await supabaseAdmin
          .from('job_queue')
          .select('payload')
          .eq('tenant_id', tenant.id)
          .eq('type', 'rag_index')
          .eq('status', 'failed');

        const failedDocIds = new Set<string>();
        if (!failedJobsError && failedJobs) {
          failedJobs.forEach((job: { payload: { document_id?: string } }) => {
            if (job.payload?.document_id) {
              failedDocIds.add(job.payload.document_id);
            }
          });
        }

        // Transform documents with indexing status
        const sources = (documents || []).map((doc: any) => {
          let indexingStatus: 'indexed' | 'pending' | 'outdated' | 'failed' = 'pending';
          
          if (failedDocIds.has(doc.id)) {
            indexingStatus = 'failed';
          } else if (doc.last_indexed_at) {
            if (new Date(doc.updated_at) > new Date(doc.last_indexed_at)) {
              indexingStatus = 'outdated';
            } else {
              indexingStatus = 'indexed';
            }
          }

          // Detect file type from content or title
          let fileType: 'pdf' | 'docx' | 'md' | 'unknown' = 'md';
          const titleLower = doc.title.toLowerCase();
          if (titleLower.includes('.pdf') || titleLower.includes('(pdf)')) {
            fileType = 'pdf';
          } else if (titleLower.includes('.docx') || titleLower.includes('(docx)')) {
            fileType = 'docx';
          }

          return {
            id: doc.id,
            title: doc.title,
            file_type: fileType,
            indexing_status: indexingStatus,
            chunk_count: chunkCountMap[doc.id] || 0,
            content_length: doc.content?.length || 0,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            last_indexed_at: doc.last_indexed_at,
            author: doc.users,
          };
        });

        // Apply status filter (post-query since it's computed)
        const filteredSources = status
          ? sources.filter((s: any) => s.indexing_status === status)
          : sources;

        const totalPages = Math.ceil((count || 0) / limit);

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            page,
            limit,
            totalSources: count,
            returnedSources: filteredSources.length,
          },
          'Sources list retrieved successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            sources: filteredSources,
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/sources');
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
   * GET /api/sources/normalized
   * Returns documents with normalized markdown content for RAG
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   */
  fastify.get(
    '/api/sources/normalized',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Parse query parameters
        const querySchema = z.object({
          limit: z.coerce.number().int().min(1).max(500).default(100),
        });
        const { limit } = querySchema.parse(request.query);

        // Fetch documents with content for the tenant
        // Only include documents that have non-empty content
        const { data: documents, error } = await supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            status,
            visibility,
            created_at,
            updated_at
          `)
          .eq('tenant_id', tenant.id)
          .not('content', 'is', null)
          .not('content', 'eq', '')
          .not('content', 'like', '__CATEGORY__%')
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (error) {
          fastify.log.error(
            { error, tenantId: tenant.id, userId: user.id },
            'Failed to fetch normalized documents'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch documents',
              details: {},
            },
          });
        }

        // Map documents to the normalized format expected by frontend
        const normalizedDocs = (documents || [])
          .filter((doc: any) => doc.content && doc.content.trim().length > 0)
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            normalizedMd: doc.content,
            status: doc.status,
            visibility: doc.visibility,
            createdAt: doc.created_at,
            updatedAt: doc.updated_at,
          }));

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            count: normalizedDocs.length,
          },
          'Normalized documents fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            documents: normalizedDocs,
            count: normalizedDocs.length,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/sources/normalized');
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
   * POST /api/sources/repair/stuck-jobs
   * Resets jobs stuck in 'processing' state for too long
   * This can happen when workers crash or are terminated mid-job
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' role
   */
  fastify.post(
    '/api/sources/repair/stuck-jobs',
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
              message: 'Only admin users can repair stuck jobs',
              details: {},
            },
          });
        }

        const bodySchema = z.object({
          max_age_minutes: z.number().int().min(1).max(1440).default(30),
        });
        const body = bodySchema.parse(request.body);
        const { max_age_minutes } = body;

        // Find jobs stuck in processing state for longer than max_age_minutes
        const cutoffTime = new Date(Date.now() - max_age_minutes * 60 * 1000).toISOString();
        
        const { data: stuckJobs, error: fetchError } = await supabaseAdmin
          .from('job_queue')
          .select('id, type, payload, worker_id, attempts, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'processing')
          .lt('created_at', cutoffTime);

        if (fetchError) {
          fastify.log.error(
            { error: fetchError, tenantId: tenant.id },
            'Failed to query stuck jobs'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to query stuck jobs',
              details: {},
            },
          });
        }

        const stuckRagIndexJobs = (stuckJobs || []).filter(job => job.type === 'rag_index');
        const resetJobIds: string[] = [];
        const failedJobIds: string[] = [];

        // Reset each stuck job
        for (const job of stuckRagIndexJobs) {
          // If job has exceeded max retry attempts, mark as failed
          if (job.attempts >= 3) {
            const { error: failError } = await supabaseAdmin
              .from('job_queue')
              .update({
                status: 'failed',
                result: { error: 'Job stuck in processing and exceeded retry attempts' },
                completed_at: new Date().toISOString(),
                worker_id: null,
              })
              .eq('id', job.id);

            if (!failError) {
              failedJobIds.push(job.id);
            }
          } else {
            // Reset to pending for retry
            const { error: resetError } = await supabaseAdmin
              .from('job_queue')
              .update({
                status: 'pending',
                worker_id: null,
              })
              .eq('id', job.id);

            if (!resetError) {
              resetJobIds.push(job.id);
            }
          }
        }

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            stuckJobsFound: stuckRagIndexJobs.length,
            resetJobs: resetJobIds.length,
            failedJobs: failedJobIds.length,
          },
          'Stuck jobs repair completed'
        );

        return reply.code(200).send({
          success: true,
          data: {
            stuck_jobs_found: stuckRagIndexJobs.length,
            reset_jobs: resetJobIds.length,
            failed_jobs: failedJobIds.length,
            job_ids_reset: resetJobIds,
            job_ids_failed: failedJobIds,
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

        fastify.log.error({ error }, 'Unexpected error in POST /api/sources/repair/stuck-jobs');
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
   * POST /api/sources/repair/orphaned
   * Fixes documents with orphaned/missing embeddings
   * - Documents with last_indexed_at but no embeddings
   * - Documents with embeddings but no last_indexed_at
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - User must have 'admin' role
   */
  fastify.post(
    '/api/sources/repair/orphaned',
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
              message: 'Only admin users can repair orphaned embeddings',
              details: {},
            },
          });
        }

        // Find documents with last_indexed_at but no embeddings (orphaned index state)
        const { data: indexedDocs, error: indexedError } = await supabaseAdmin
          .from('documents')
          .select('id, title, last_indexed_at')
          .eq('tenant_id', tenant.id)
          .not('last_indexed_at', 'is', null);

        if (indexedError) {
          fastify.log.error(
            { error: indexedError, tenantId: tenant.id },
            'Failed to query indexed documents'
          );
          return reply.code(500).send({
            error: {
              code: 'QUERY_FAILED',
              message: 'Failed to query indexed documents',
              details: {},
            },
          });
        }

        // Get all document IDs that have embeddings
        const docIds = (indexedDocs || []).map(d => d.id);
        let docIdsWithEmbeddings: Set<string> = new Set();
        
        if (docIds.length > 0) {
          const { data: embeddings, error: embedError } = await supabaseAdmin
            .from('document_embeddings')
            .select('document_id')
            .eq('tenant_id', tenant.id)
            .in('document_id', docIds);

          if (!embedError && embeddings) {
            docIdsWithEmbeddings = new Set(embeddings.map(e => e.document_id));
          }
        }

        // Find documents with last_indexed_at but no embeddings
        const orphanedDocs = (indexedDocs || []).filter(
          doc => !docIdsWithEmbeddings.has(doc.id)
        );

        // Find documents with embeddings but no last_indexed_at (inconsistent state)
        const { data: allDocsNoTimestamp, error: fallbackError } = await supabaseAdmin
          .from('documents')
          .select('id, title')
          .eq('tenant_id', tenant.id)
          .is('last_indexed_at', null);

        if (!fallbackError && allDocsNoTimestamp && allDocsNoTimestamp.length > 0) {
          const { data: embeddingsForUntracked, error: embedCheckError } = await supabaseAdmin
            .from('document_embeddings')
            .select('document_id')
            .eq('tenant_id', tenant.id)
            .in('document_id', allDocsNoTimestamp.map(d => d.id));

          if (!embedCheckError && embeddingsForUntracked) {
            const untrackedDocIds = new Set(embeddingsForUntracked.map(e => e.document_id));
            // These docs have embeddings but no last_indexed_at - update them
            for (const doc of allDocsNoTimestamp) {
              if (untrackedDocIds.has(doc.id)) {
                await supabaseAdmin
                  .from('documents')
                  .update({ last_indexed_at: new Date().toISOString() })
                  .eq('id', doc.id)
                  .eq('tenant_id', tenant.id);
              }
            }
          }
        }

        // Clear last_indexed_at for orphaned docs and dispatch reindex jobs
        const repairedDocs: Array<{ id: string; title: string }> = [];
        
        for (const doc of orphanedDocs) {
          // Clear the last_indexed_at to mark as needing reindex
          const { error: clearError } = await supabaseAdmin
            .from('documents')
            .update({ last_indexed_at: null })
            .eq('id', doc.id)
            .eq('tenant_id', tenant.id);

          if (!clearError) {
            repairedDocs.push({ id: doc.id, title: doc.title });
          }
        }

        fastify.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            orphanedDocsFound: orphanedDocs.length,
            repairedDocs: repairedDocs.length,
          },
          'Orphaned embeddings repair completed'
        );

        return reply.code(200).send({
          success: true,
          data: {
            orphaned_docs_found: orphanedDocs.length,
            repaired_docs: repairedDocs,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/sources/repair/orphaned');
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
