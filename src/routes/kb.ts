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

        // Fetch tenant by subdomain or custom domain
        const isFullDomain = subdomain.includes('.');
        let tenantQuery = supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, settings');
          
        if (isFullDomain) {
          tenantQuery = tenantQuery.eq('custom_domain', subdomain.toLowerCase()).eq('custom_domain_verified', true);
        } else {
          tenantQuery = tenantQuery.eq('subdomain', subdomain.toLowerCase());
        }

        const { data: tenant, error: tenantError } = await tenantQuery.single();

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

        // Resolve allowed visibilities based on authentication
        const allowedVisibilities = ['public', 'community'];
        const authHeader = request.headers.authorization;
        if (authHeader) {
          try {
            const token = authHeader.replace(/^Bearer\s+/i, '');
            const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token);
            if (authUser) {
              // Check if user is a member of this tenant
              const { data: membership } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .maybeSingle();
              
              if (membership) {
                allowedVisibilities.push('team');
              }
            }
          } catch (e) {
            // Ignore auth errors for public routes
          }
        }

        // Get document counts per category
        const { data: docCounts } = await supabaseAdmin
          .from('documents')
          .select('category_id')
          .eq('tenant_id', tenant.id)
          .eq('status', 'published')
          .in('visibility', allowedVisibilities);

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
        // Exclude system/placeholder names: 'default' and 'uncategorised'/'uncategorized'.
        const hiddenNames = new Set(['default', 'uncategorised', 'uncategorized']);
        const filteredCategories = (categories || [])
          .filter((cat: any) => !hiddenNames.has((cat.name || '').toLowerCase()))
          .map((cat: any) => ({
            ...cat,
            document_count: countMap[cat.id] || 0,
          }));

        // Total documents is the sum of documents in the VISIBLE categories only.
        const totalDocuments = filteredCategories.reduce((acc, cat) => acc + (cat.document_count || 0), 0);

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
            totalDocuments,
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
   * GET /api/public/kb/:subdomain/tags
   * Returns all tags that are attached to at least one published, categorised document
   * for this tenant. Used to populate the tag filter dropdown on the KB portal.
   */
  fastify.get(
    '/api/public/kb/:subdomain/tags',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };

        const isFullDomain = subdomain.includes('.');
        let tenantQuery = supabaseAdmin.from('tenants').select('id');
        if (isFullDomain) {
          tenantQuery = tenantQuery.eq('custom_domain', subdomain.toLowerCase()).eq('custom_domain_verified', true);
        } else {
          tenantQuery = tenantQuery.eq('subdomain', subdomain.toLowerCase());
        }
        const { data: tenant, error: tenantError } = await tenantQuery.single();
        if (tenantError || !tenant) {
          return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' } });
        }

        // Tags are tenant-scoped — query the tags table directly by tenant_id.
        // This is simpler and avoids RLS/join issues on document_tags.
        const { data: tags, error } = await supabaseAdmin
          .from('tags')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .order('name', { ascending: true });

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch KB tags');
          return reply.code(500).send({ error: { code: 'FETCH_FAILED', message: 'Failed to fetch tags' } });
        }

        return reply.code(200).send({ success: true, data: { tags: tags || [] } });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/kb/:subdomain/tags');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
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
          limit: z.coerce.number().int().min(1).max(500).default(20),
          category_id: z.string().optional(),
          tag_id: z.string().uuid().optional(),
          search: z.string().max(200).optional(),
        });

        const query = querySchema.parse(request.query);
        const offset = (query.page - 1) * query.limit;

        // Resolve tenant by subdomain or custom domain
        const isFullDomain = subdomain.includes('.');
        let tenantQuery = supabaseAdmin
          .from('tenants')
          .select('id');
          
        if (isFullDomain) {
          tenantQuery = tenantQuery.eq('custom_domain', subdomain.toLowerCase()).eq('custom_domain_verified', true);
        } else {
          tenantQuery = tenantQuery.eq('subdomain', subdomain.toLowerCase());
        }

        const { data: tenant, error: tenantError } = await tenantQuery.single();

        if (tenantError || !tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' },
          });
        }

        // Resolve allowed visibilities based on authentication
        const allowedVisibilities = ['public', 'community'];
        const authHeader = request.headers.authorization;
        if (authHeader) {
          try {
            const token = authHeader.replace(/^Bearer\s+/i, '');
            const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token);
            if (authUser) {
              const { data: membership } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .maybeSingle();
              if (membership) allowedVisibilities.push('team');
            }
          } catch (e) {}
        }

        // Resolve IDs of hidden categories (default, uncategorised) so we can exclude their docs
        const { data: hiddenCats } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('tenant_id', tenant.id)
          .in('name', ['Default', 'default', 'Uncategorised', 'uncategorised', 'Uncategorized', 'uncategorized']);
        const hiddenCatIds = (hiddenCats || []).map((c: { id: string }) => c.id);

        // If filtering by tag, resolve document IDs first (PostgREST embedded filters
        // only filter the joined rows, not the parent rows, so we need a subquery).
        let tagDocIds: string[] | null = null;
        if (query.tag_id) {
          const { data: taggedDocs } = await supabaseAdmin
            .from('document_tags')
            .select('document_id')
            .eq('tag_id', query.tag_id);
          tagDocIds = taggedDocs?.map((r: { document_id: string }) => r.document_id) ?? [];
        }

        // If the tag exists but no documents have it, return empty immediately
        if (tagDocIds !== null && tagDocIds.length === 0) {
          const totalPages = 0;
          return reply.send({
            documents: [],
            pagination: { page: query.page, limit: query.limit, total: 0, totalPages, hasNextPage: false, hasPrevPage: false },
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
            visibility,
            status,
            created_at,
            updated_at,
            published_at,
            view_count,
            ai_score,
            category:categories (
              id,
              name,
              color
            ),
            users!documents_author_id_fkey (
              id,
              full_name,
              avatar_url
            ),
            tags:document_tags (
              tag:tags (
                id,
                name,
                description
              )
            )
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .eq('status', 'published')
          .in('visibility', allowedVisibilities)
          // Exclude uncategorised and hidden-category documents from the public KB
          .not('category_id', 'is', null)
          .order('published_at', { ascending: false });

        if (hiddenCatIds.length > 0) {
          dbQuery = dbQuery.not('category_id', 'in', `(${hiddenCatIds.join(',')})`);
        }

        if (query.category_id) {
          if (z.string().uuid().safeParse(query.category_id).success) {
            dbQuery = dbQuery.eq('category_id', query.category_id);
          }
        }
        if (tagDocIds !== null && tagDocIds.length > 0) {
          dbQuery = dbQuery.in('id', tagDocIds);
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
          author: doc.users || { full_name: 'Unknown Author' },
          users: undefined, // Remove users field to avoid confusion
          category: doc.category,
          tags: (doc.tags || []).map((jt: any) => jt.tag).filter(Boolean),
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

        // Resolve tenant by subdomain or custom domain
        const isFullDomain = subdomain.includes('.');
        let tenantQuery = supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, settings');
          
        if (isFullDomain) {
          tenantQuery = tenantQuery.eq('custom_domain', subdomain.toLowerCase()).eq('custom_domain_verified', true);
        } else {
          tenantQuery = tenantQuery.eq('subdomain', subdomain.toLowerCase());
        }

        const { data: tenant } = await tenantQuery.single();

        if (!tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Knowledge base not found' },
          });
        }

        // Resolve allowed visibilities
        const allowedVisibilities = ['public', 'community'];
        const authHeader = request.headers.authorization;
        if (authHeader) {
          try {
            const token = authHeader.replace(/^Bearer\s+/i, '');
            const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token);
            if (authUser) {
              const { data: membership } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .maybeSingle();
              if (membership) allowedVisibilities.push('team');
            }
          } catch (e) {}
        }

        const { data: document, error } = await supabaseAdmin
          .from('documents')
          .select(`
            id, title, content, created_at, updated_at, published_at, view_count,
            category:categories (id, name, color),
            users!documents_author_id_fkey (id, full_name, avatar_url),
            tags:document_tags (
              tag:tags (id, name, description)
            )
          `)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .in('visibility', allowedVisibilities)
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
        const rawDoc = document as any;
        const processedDoc = {
          ...rawDoc,
          author: rawDoc.users || { full_name: 'Unknown Author' },
          users: undefined, // Remove users field to avoid confusion
          category: rawDoc.category,
          tags: (rawDoc.tags || []).map((t: any) => t.tag).filter(Boolean),
          content: rewriteAssetUrlsForPublicAccess(rawDoc.content || '', id, apiBaseUrl),
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
