"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = discussionAssetRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const rateLimit_1 = require("../middleware/rateLimit");
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const uploadAssetParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/**
 * Discussion Asset Upload Routes
 * Handles image and video uploads for community discussions
 */
async function discussionAssetRoutes(fastify) {
    /**
     * POST /api/discussions/:id/upload
     * Uploads an image or video asset for a discussion
     */
    fastify.post('/api/discussions/:id/upload', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const params = uploadAssetParamsSchema.parse(request.params);
            const { id: discussionId } = params;
            // Verify discussion exists (no tenant filter since community is cross-tenant)
            const { data: discussion, error: discError } = await supabase_1.supabaseAdmin
                .from('discussions')
                .select('id')
                .eq('id', discussionId)
                .single();
            if (discError || !discussion) {
                return reply.code(404).send({
                    error: {
                        code: 'DISCUSSION_NOT_FOUND',
                        message: 'Discussion not found',
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
            // Store in community-assets path (not tenant-scoped since discussions are cross-tenant)
            const storagePath = `community/discussions/${discussionId}/${timestamp}_${sanitizedFilename}`;
            fastify.log.info({
                filename: sanitizedFilename,
                storagePath,
                fileSize,
                mimetype,
                discussionId,
                userId: user.id,
                assetType: isImage ? 'image' : 'video',
            }, 'Uploading discussion asset to storage');
            const { data: uploadData, error: uploadError } = await supabase_1.supabaseAdmin
                .storage
                .from('tenant-documents')
                .upload(storagePath, fileBuffer, {
                contentType: mimetype,
                upsert: false,
            });
            if (uploadError) {
                fastify.log.error({
                    filename: sanitizedFilename,
                    storagePath,
                    discussionId,
                    error: uploadError.message,
                }, 'Failed to upload discussion asset to storage');
                return reply.code(500).send({
                    error: {
                        code: 'UPLOAD_FAILED',
                        message: 'Failed to upload asset file',
                        details: {},
                    },
                });
            }
            const { data: signedUrlData, error: signedUrlError } = await supabase_1.supabaseAdmin
                .storage
                .from('tenant-documents')
                .createSignedUrl(uploadData.path, 31536000); // 1 year expiration for community assets
            if (signedUrlError) {
                fastify.log.error({
                    storagePath: uploadData.path,
                    discussionId,
                    error: signedUrlError.message,
                }, 'Failed to generate signed URL for discussion asset');
                return reply.code(500).send({
                    error: {
                        code: 'SIGNED_URL_FAILED',
                        message: 'Failed to generate signed URL',
                        details: {},
                    },
                });
            }
            fastify.log.info({
                filename: sanitizedFilename,
                storagePath: uploadData.path,
                discussionId,
                userId: user.id,
                assetType: isImage ? 'image' : 'video',
            }, 'Discussion asset uploaded successfully');
            return reply.code(201).send({
                success: true,
                storage_path: uploadData.path,
                signed_url: signedUrlData.signedUrl,
                filename: sanitizedFilename,
                file_size: fileSize,
                mimetype: mimetype,
                asset_type: isImage ? 'image' : 'video',
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid discussion ID format',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/upload');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
}
//# sourceMappingURL=discussion-assets.js.map