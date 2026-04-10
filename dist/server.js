"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const requestLogger_1 = require("./middleware/requestLogger");
const errorHandler_1 = require("./middleware/errorHandler");
const buildServer = () => {
    const fastify = (0, fastify_1.default)({
        logger: (0, logger_1.getLoggerConfig)(),
    });
    return fastify;
};
const start = async () => {
    const fastify = buildServer();
    try {
        // Register request logging middleware globally
        fastify.addHook('onRequest', requestLogger_1.requestLoggerMiddleware);
        // Register error handler middleware globally
        fastify.setErrorHandler(errorHandler_1.errorHandler);
        await fastify.register(helmet_1.default, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
            // Allow cross-origin resource loading for asset proxy endpoints
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        });
        const allowedOrigins = env_1.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
        await fastify.register(cors_1.default, {
            origin: (origin, cb) => {
                if (!origin) {
                    cb(null, true);
                    return;
                }
                // Allow static origins from env
                if (allowedOrigins.includes(origin)) {
                    cb(null, true);
                    return;
                }
                // Allow any *.tynebase.com subdomain
                try {
                    const url = new URL(origin);
                    if (url.hostname.endsWith('.tynebase.com')) {
                        cb(null, true);
                        return;
                    }
                }
                catch { }
                cb(new Error('Not allowed by CORS'), false);
            },
            credentials: true,
        });
        await fastify.register(multipart_1.default, {
            limits: {
                fileSize: 500 * 1024 * 1024,
            },
        });
        // Store raw body for Stripe webhook signature verification
        fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
            try {
                const rawUrl = req.url || '';
                if (rawUrl.startsWith('/api/billing/webhook')) {
                    // Keep raw body for Stripe verification, also parse as JSON
                    req.rawBody = body;
                    done(null, JSON.parse(body));
                }
                else {
                    // Handle empty body for DELETE requests
                    if (!body || body.trim() === '') {
                        done(null, null);
                    }
                    else {
                        done(null, JSON.parse(body));
                    }
                }
            }
            catch (err) {
                done(err, undefined);
            }
        });
        fastify.get('/health', async () => {
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: env_1.env.NODE_ENV,
            };
        });
        fastify.get('/', async () => {
            return {
                name: 'TyneBase API',
                version: '1.0.0',
                status: 'running',
            };
        });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/auth'))), { prefix: '' });
        // Test routes - only available in development
        if (env_1.isDev) {
            await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/test'))), { prefix: '' });
            await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/test-error'))), { prefix: '' });
            await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/auth-test'))), { prefix: '' });
            await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-test'))), { prefix: '' });
        }
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-overview'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-tenants'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-impersonate'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-suspend'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-change-tier'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/superadmin-users'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/tenants'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/kb'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/community-public'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/dashboard'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/documents'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/document-assets'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/categories'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/collections'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/templates'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/tags'))), { prefix: '' });
        if (env_1.isDev) {
            await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-test'))), { prefix: '' });
        }
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-generate'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-enhance'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-apply-suggestion'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-scrape'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/video-upload'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/youtube-video'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/direct-video-url'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/video-transcribe-to-document'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/audio-upload'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/media-jobs'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ai-generations'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/document-import'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/legal-document-upload'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/jobs'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/rag'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/users'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/invites'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/integrations'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/gdpr'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/knowledge-activity'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/audit'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/notifications'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/chat'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/chat-assignments'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/dm'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/discussions'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/discussion-assets'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/document-shares'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/tier-upgrade'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/stripe-billing'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/credits-purchase'))), { prefix: '' });
        await fastify.register(Promise.resolve().then(() => __importStar(require('./routes/contact'))), { prefix: '' });
        const port = parseInt(env_1.env.PORT, 10);
        await fastify.listen({ port, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://localhost:${port}`);
        fastify.log.info(`Health check available at http://localhost:${port}/health`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map