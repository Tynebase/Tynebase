import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { env, isDev } from './config/env';

const buildServer = () => {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  return fastify;
};

const start = async () => {
  const fastify = buildServer();

  try {
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    
    await fastify.register(cors, {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 500 * 1024 * 1024,
      },
    });

    fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
      };
    });

    fastify.get('/', async () => {
      return {
        name: 'TyneBase API',
        version: '1.0.0',
        status: 'running',
      };
    });

    await fastify.register(import('./routes/test'), { prefix: '' });
    await fastify.register(import('./routes/auth'), { prefix: '' });
    await fastify.register(import('./routes/auth-test'), { prefix: '' });
    await fastify.register(import('./routes/tenants'), { prefix: '' });
    await fastify.register(import('./routes/documents'), { prefix: '' });
    await fastify.register(import('./routes/templates'), { prefix: '' });
    await fastify.register(import('./routes/ai-test'), { prefix: '' });
    await fastify.register(import('./routes/ai-generate'), { prefix: '' });
    await fastify.register(import('./routes/ai-enhance'), { prefix: '' });
    await fastify.register(import('./routes/ai-apply-suggestion'), { prefix: '' });
    await fastify.register(import('./routes/video-upload'), { prefix: '' });
    await fastify.register(import('./routes/youtube-video'), { prefix: '' });
    await fastify.register(import('./routes/document-import'), { prefix: '' });
    await fastify.register(import('./routes/jobs'), { prefix: '' });
    await fastify.register(import('./routes/rag'), { prefix: '' });

    const port = parseInt(env.PORT, 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    fastify.log.info(`Server listening on http://localhost:${port}`);
    fastify.log.info(`Health check available at http://localhost:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
