import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

/**
 * Zod schema for POST /api/documents/:id/upload path parameters
 */
const uploadAssetParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for GET /api/documents/:id/assets path parameters
 */
const listAssetsParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for DELETE /api/documents/:id/assets/:assetId path parameters
 */
const deleteAssetParamsSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().min(1),
});

/**
 * Document Asset Upload Routes
 * Handles image and video uploads for documents
 */
export default async function documentAssetRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/documents/:id/upload
   * Uploads an image or video asset for a document
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Request Body:
   * - Multipart form data with file field
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - Document must belong to user's tenant
   * 
   * Security:
   * - Validates file type (images: jpg, png, gif, webp, svg; videos: mp4, mov, webm)
   * - Validates file size (max 10MB for images, 50MB for videos)
   * - Sanitizes filename to prevent path traversal
   * - Stores in tenant-isolated storage bucket
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Returns signed URL with 1-hour expiration
   * 
   * Storage:
   * - Bucket: tenant-documents
   * - Path: tenant-{tenant_id}/documents/{document_id}/{timestamp}_{filename}
   * - Content-Type preserved from upload
   * 
   * Response:
   * - 201: Asset uploaded successfully with signed URL
   * - 400: Invalid file type, size, or missing file
   * - 404: Document not found or access denied
   * - 500: Upload failed or internal error
   */
  fastify.post(
    '/api/documents/:id/upload',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const params = uploadAssetParamsSchema.parse(request.params);
        const { id: documentId } = params;

        const { error: docError } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('id', documentId)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError) {
          if (docError.code === 'PGRST116') {
            fastify.log.warn(
              { documentId, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied'
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
            'Failed to fetch document for asset upload'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            error: {
              code: 'NO_FILE_UPLOADED',
              message: 'No file was uploaded',
              details: {},
            },
          });
        }

        const filename = data.filename;
        const mimetype = data.mimetype;

        const isImage = ALLOWED_IMAGE_TYPES.includes(mimetype);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(mimetype);

        if (!isImage && !isVideo) {
          fastify.log.warn(
            {
              filename,
              mimetype,
              documentId,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid asset file type'
          );
          return reply.code(400).send({
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Invalid file type. Allowed types: ${[...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS].join(', ')}`,
              details: {},
            },
          });
        }

        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        const allowedExtensions = isImage ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_VIDEO_EXTENSIONS;

        if (!allowedExtensions.includes(fileExtension)) {
          fastify.log.warn(
            {
              filename,
              fileExtension,
              documentId,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid asset file extension'
          );
          return reply.code(400).send({
            error: {
              code: 'INVALID_FILE_EXTENSION',
              message: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`,
              details: {},
            },
          });
        }

        const fileBuffer = await data.toBuffer();
        const fileSize = fileBuffer.length;

        const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
        if (fileSize > maxSize) {
          fastify.log.warn(
            {
              filename,
              fileSize,
              maxSize,
              documentId,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Asset file size exceeds limit'
          );
          return reply.code(400).send({
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`,
              details: {},
            },
          });
        }

        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `tenant-${tenant.id}/documents/${documentId}/${timestamp}_${sanitizedFilename}`;

        fastify.log.info(
          {
            filename: sanitizedFilename,
            storagePath,
            fileSize,
            mimetype,
            documentId,
            tenantId: tenant.id,
            userId: user.id,
            assetType: isImage ? 'image' : 'video',
          },
          'Uploading asset to storage'
        );

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('tenant-documents')
          .upload(storagePath, fileBuffer, {
            contentType: mimetype,
            upsert: false,
          });

        if (uploadError) {
          fastify.log.error(
            {
              filename: sanitizedFilename,
              storagePath,
              documentId,
              tenantId: tenant.id,
              error: uploadError.message,
            },
            'Failed to upload asset to storage'
          );
          return reply.code(500).send({
            error: {
              code: 'UPLOAD_FAILED',
              message: 'Failed to upload asset file',
              details: {},
            },
          });
        }

        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
          .storage
          .from('tenant-documents')
          .createSignedUrl(uploadData.path, 3600);

        if (signedUrlError) {
          fastify.log.error(
            {
              storagePath: uploadData.path,
              documentId,
              tenantId: tenant.id,
              error: signedUrlError.message,
            },
            'Failed to generate signed URL for uploaded asset'
          );
          return reply.code(500).send({
            error: {
              code: 'SIGNED_URL_FAILED',
              message: 'Failed to generate signed URL',
              details: {},
            },
          });
        }

        fastify.log.info(
          {
            filename: sanitizedFilename,
            storagePath: uploadData.path,
            documentId,
            tenantId: tenant.id,
            userId: user.id,
            assetType: isImage ? 'image' : 'video',
          },
          'Asset uploaded successfully'
        );

        return reply.code(201).send({
          success: true,
          data: {
            storage_path: uploadData.path,
            signed_url: signedUrlData.signedUrl,
            filename: sanitizedFilename,
            file_size: fileSize,
            mimetype: mimetype,
            asset_type: isImage ? 'image' : 'video',
            expires_in: 3600,
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

        fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/upload');
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
   * GET /api/documents/:id/assets
   * Lists all assets (images and videos) for a document
   * 
   * Path Parameters:
   * - id: Document UUID
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - Document must belong to user's tenant
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Verifies document exists and belongs to user's tenant
   * - Returns signed URLs with 1-hour expiration
   * 
   * Response:
   * - 200: List of assets with metadata and signed URLs
   * - 404: Document not found or access denied
   * - 500: Failed to list assets or internal error
   */
  fastify.get(
    '/api/documents/:id/assets',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const params = listAssetsParamsSchema.parse(request.params);
        const { id: documentId } = params;

        const { error: docError } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('id', documentId)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError) {
          if (docError.code === 'PGRST116') {
            fastify.log.warn(
              { documentId, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied'
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
            'Failed to fetch document for asset listing'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        const storagePath = `tenant-${tenant.id}/documents/${documentId}`;

        fastify.log.info(
          {
            documentId,
            tenantId: tenant.id,
            userId: user.id,
            storagePath,
          },
          'Listing assets for document'
        );

        const { data: files, error: listError } = await supabaseAdmin
          .storage
          .from('tenant-documents')
          .list(storagePath, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (listError) {
          fastify.log.error(
            {
              storagePath,
              documentId,
              tenantId: tenant.id,
              error: listError.message,
            },
            'Failed to list assets from storage'
          );
          return reply.code(500).send({
            error: {
              code: 'LIST_FAILED',
              message: 'Failed to list assets',
              details: {},
            },
          });
        }

        const assets = await Promise.all(
          (files || []).map(async (file) => {
            const fullPath = `${storagePath}/${file.name}`;
            
            const { data: signedUrlData } = await supabaseAdmin
              .storage
              .from('tenant-documents')
              .createSignedUrl(fullPath, 3600);

            const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension);
            const isVideo = ALLOWED_VIDEO_EXTENSIONS.includes(fileExtension);

            return {
              name: file.name,
              storage_path: fullPath,
              signed_url: signedUrlData?.signedUrl || null,
              size: file.metadata?.size || 0,
              created_at: file.created_at,
              updated_at: file.updated_at,
              asset_type: isImage ? 'image' : isVideo ? 'video' : 'unknown',
              expires_in: 3600,
            };
          })
        );

        fastify.log.info(
          {
            documentId,
            tenantId: tenant.id,
            userId: user.id,
            assetCount: assets.length,
          },
          'Assets listed successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            document_id: documentId,
            assets,
            total: assets.length,
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

        fastify.log.error({ error }, 'Unexpected error in GET /api/documents/:id/assets');
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
   * DELETE /api/documents/:id/assets/:assetId
   * Deletes an asset (image or video) from a document
   * 
   * Path Parameters:
   * - id: Document UUID
   * - assetId: Asset filename (e.g., "1234567890_image.jpg")
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * - Document must belong to user's tenant
   * 
   * Security:
   * - Enforces tenant isolation via explicit tenant_id filtering
   * - Verifies document exists and belongs to user's tenant
   * - Validates asset path to prevent path traversal attacks
   * - Only deletes assets within tenant's document folder
   * - Prevents orphaned assets by verifying full storage path
   * 
   * Storage:
   * - Deletes from bucket: tenant-documents
   * - Path: tenant-{tenant_id}/documents/{document_id}/{assetId}
   * 
   * Response:
   * - 200: Asset deleted successfully
   * - 400: Invalid parameters or asset ID
   * - 404: Document or asset not found
   * - 500: Failed to delete asset or internal error
   */
  fastify.delete(
    '/api/documents/:id/assets/:assetId',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        const params = deleteAssetParamsSchema.parse(request.params);
        const { id: documentId, assetId } = params;

        const { error: docError } = await supabaseAdmin
          .from('documents')
          .select('id')
          .eq('id', documentId)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError) {
          if (docError.code === 'PGRST116') {
            fastify.log.warn(
              { documentId, tenantId: tenant.id, userId: user.id },
              'Document not found or access denied'
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
            'Failed to fetch document for asset deletion'
          );
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch document',
              details: {},
            },
          });
        }

        if (assetId.includes('/') || assetId.includes('\\') || assetId.includes('..')) {
          fastify.log.warn(
            {
              assetId,
              documentId,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid asset ID - potential path traversal attempt'
          );
          return reply.code(400).send({
            error: {
              code: 'INVALID_ASSET_ID',
              message: 'Invalid asset ID format',
              details: {},
            },
          });
        }

        const storagePath = `tenant-${tenant.id}/documents/${documentId}/${assetId}`;

        fastify.log.info(
          {
            assetId,
            storagePath,
            documentId,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Attempting to delete asset'
        );

        const { data: files, error: listError } = await supabaseAdmin
          .storage
          .from('tenant-documents')
          .list(`tenant-${tenant.id}/documents/${documentId}`, {
            limit: 1000,
          });

        if (listError) {
          fastify.log.error(
            {
              documentId,
              tenantId: tenant.id,
              error: listError.message,
            },
            'Failed to list assets for verification'
          );
          return reply.code(500).send({
            error: {
              code: 'LIST_FAILED',
              message: 'Failed to verify asset existence',
              details: {},
            },
          });
        }

        const assetExists = files?.some(file => file.name === assetId);

        if (!assetExists) {
          fastify.log.warn(
            {
              assetId,
              documentId,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Asset not found'
          );
          return reply.code(404).send({
            error: {
              code: 'ASSET_NOT_FOUND',
              message: 'Asset not found',
              details: {},
            },
          });
        }

        const { error: deleteError } = await supabaseAdmin
          .storage
          .from('tenant-documents')
          .remove([storagePath]);

        if (deleteError) {
          fastify.log.error(
            {
              storagePath,
              assetId,
              documentId,
              tenantId: tenant.id,
              error: deleteError.message,
            },
            'Failed to delete asset from storage'
          );
          return reply.code(500).send({
            error: {
              code: 'DELETE_FAILED',
              message: 'Failed to delete asset',
              details: {},
            },
          });
        }

        fastify.log.info(
          {
            assetId,
            storagePath,
            documentId,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Asset deleted successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Asset deleted successfully',
            asset_id: assetId,
            document_id: documentId,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in DELETE /api/documents/:id/assets/:assetId');
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
