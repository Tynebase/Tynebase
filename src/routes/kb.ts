import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Rewrites Supabase signed URLs in document content to use the public asset proxy.
 */
function rewriteAssetUrlsForPublicAccess(content: string, documentId: string, apiBaseUrl: string): string {
  if (!content) return content;
  const regex = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/sign\/tenant-documents\/tenant-[^/]+\/documents\/[^/]+\/([^?\s"']+)\?[^"'\s)]+/g;
  return content.replace(regex, `${apiBaseUrl}/api/documents/${documentId}/assets/public/$1`);
}

/**
 * Public Knowledge Base routes - no authentication required.
 * Serves tenant-scoped KB data (branding, categories, documents).
 */
export default async function kbRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/public/kb/:subdomain
   * Returns tenant branding + categories with published document counts.
   * This powers the KB landing page.
   */
  fastify.get(
    '/api/public/kb/:subdomain',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };

        // Fetch tenant by subdomain
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, settings')
          .eq('subdomain', subdomain.toLowerCase())
          .single();

        if (tenantError || !tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' },
          });
        }

        // Fetch categories for this tenant with published+public document counts
        const { data: categories } = await supabaseAdmin
          .from('categories')
          .select('id, name, description, color, icon, sort_order, parent_id')
          .eq('tenant_id', tenant.id)
          .order('sort_order', { ascending: true });

        // Get document counts per category (published + public/community visibility only)
        const { data: docCounts } = await supabaseAdmin
          .from('documents')
          .select('category_id')
          .eq('tenant_id', tenant.id)
          .eq('status', 'published')
          .in('visibility', ['public', 'community']);

        const countMap: Record<string, number> = {};
        let uncategorizedCount = 0;
        if (docCounts) {
          for (const doc of docCounts) {
            if (doc.category_id) {
              countMap[doc.category_id] = (countMap[doc.category_id] || 0) + 1;
            } else {
              uncategorizedCount++;
            }
          }
        }

        // Show tenant categories with their public document counts.
        // Exclude internal placeholder names: 'default' and 'uncategorised'/'uncategorized'.
        const hiddenNames = new Set(['default', 'uncategorised', 'uncategorized']);
        const filteredCategories = (categories || [])
          .filter((cat: any) => !hiddenNames.has((cat.name || '').toLowerCase()))
          .map((cat: any) => ({
            ...cat,
            document_count: countMap[cat.id] || 0,
          }));

        // If there are uncategorized articles, add a "virtual" category for them
        // so the user can see them on the landing page and counts add up.
        if (uncategorizedCount > 0) {
          filteredCategories.push({
            id: 'uncategorized',
            name: 'Uncategorized',
            description: 'Articles that haven\'t been assigned to a category yet.',
            color: '#64748b',
            icon: 'FileText',
            sort_order: 999,
            parent_id: null,
            document_count: uncategorizedCount,
          });
        }

        const totalPublicDocs = docCounts?.length || 0;

        return reply.code(200).send({
          success: true,
          data: {
            tenant: {
              id: tenant.id,
              subdomain: tenant.subdomain,
              name: tenant.name,
              branding: tenant.settings?.branding || {},
            },
            categories: filteredCategories,
            totalDocuments: totalPublicDocs,
            uncategorizedCount,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/kb/:subdomain');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * GET /api/public/kb/:subdomain/documents
   * Returns published+public documents for a tenant, optionally filtered by category.
   * Supports pagination and search.
   */
  fastify.get(
    '/api/public/kb/:subdomain/documents',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };

        const querySchema = z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          category_id: z.string().optional(),
          search: z.string().max(200).optional(),
        });

        const query = querySchema.parse(request.query);
        const offset = (query.page - 1) * query.limit;

        // Resolve tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', subdomain.toLowerCase())
          .single();

        if (tenantError || !tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' },
          });
        }

        // Build query
        let dbQuery = supabaseAdmin
          .from('documents')
          .select(`
            id,
            title,
            content,
            category_id,
            created_at,
            updated_at,
            published_at,
            view_count,
            categories:category_id (
              id,
              name,
              color
            ),
            users (
              id,
              full_name,
              avatar_url
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .eq('status', 'published')
          .in('visibility', ['public', 'community'])
          .order('published_at', { ascending: false });

        if (query.category_id) {
          if (query.category_id === 'uncategorized') {
            dbQuery = dbQuery.is('category_id', null);
          } else if (z.string().uuid().safeParse(query.category_id).success) {
            dbQuery = dbQuery.eq('category_id', query.category_id);
          }
        }
        if (query.search) {
          dbQuery = dbQuery.or(`title.ilike.%${query.search}%,content.ilike.%${query.search}%`);
        }

        dbQuery = dbQuery.range(offset, offset + query.limit - 1);

        const { data: documents, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch KB documents');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch documents' },
          });
        }

        const totalPages = count ? Math.ceil(count / query.limit) : 0;
        const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';

        const processedDocs = (documents || []).map((doc: any) => ({
          ...doc,
          content: rewriteAssetUrlsForPublicAccess(doc.content || '', doc.id, apiBaseUrl),
        }));

        return reply.code(200).send({
          success: true,
          data: {
            documents: processedDocs,
            pagination: {
              page: query.page,
              limit: query.limit,
              total: count || 0,
              totalPages,
              hasNextPage: query.page < totalPages,
              hasPrevPage: query.page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Error in GET /api/public/kb/:subdomain/documents');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * GET /api/public/kb/:subdomain/documents/:id
   * Returns a single published+public document for a tenant's KB.
   * Increments view count.
   */
  fastify.get(
    '/api/public/kb/:subdomain/documents/:id',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain, id } = request.params as { subdomain: string; id: string };

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: { code: 'INVALID_ID', message: 'Invalid document ID format' },
          });
        }

        // Resolve tenant
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, settings')
          .eq('subdomain', subdomain.toLowerCase())
          .single();

        if (!tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' },
          });
        }

        const { data: document, error } = await supabaseAdmin
          .from('documents')
          .select(`
            id, title, content, created_at, updated_at, published_at, view_count,
            categories:category_id (id, name, color),
            users (id, full_name, avatar_url)
          `)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .in('visibility', ['public', 'community'])
          .eq('status', 'published')
          .single();

        if (error || !document) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Document not found' },
          });
        }

        // Increment view count
        await supabaseAdmin
          .from('documents')
          .update({ view_count: ((document as any).view_count || 0) + 1 })
          .eq('id', id);

        const apiBaseUrl = process.env.API_BASE_URL || 'https://tynebase-backend.fly.dev';
        const processedDoc = {
          ...document,
          content: rewriteAssetUrlsForPublicAccess((document as any).content || '', id, apiBaseUrl),
        };

        return reply.code(200).send({
          success: true,
          data: {
            document: processedDoc,
            tenant: {
              id: tenant.id,
              subdomain: tenant.subdomain,
              name: tenant.name,
              branding: tenant.settings?.branding || {},
            },
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/kb/:subdomain/documents/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );
}
