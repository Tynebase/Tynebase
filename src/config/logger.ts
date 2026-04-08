import { env, isDev, isProd } from './env';

/**
 * Sensitive fields that should be redacted from logs
 * Prevents accidental exposure of credentials, tokens, and PII
 */
const REDACTED_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'session',
  'sessionId',
  'access_token',
  'refresh_token',
  'bearer',
  'Bearer',
  'jwt',
  'privateKey',
  'private_key',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AXIOM_TOKEN',
  'AWS_BEDROCK_API_KEY',
  'TAVILY_API_KEY',
];

/**
 * Redaction function to sanitize sensitive fields from log objects
 * Recursively traverses objects and replaces sensitive values with [REDACTED]
 */
const redactSensitiveFields = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = REDACTED_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (shouldRedact) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
};

/**
 * Get Pino logger configuration for Fastify
 * - Development: Pretty-printed console output
 * - Production: JSON format with optional Axiom transport
 */
export const getLoggerConfig = () => {
  const baseConfig = {
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACTED_FIELDS,
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: redactSensitiveFields(req.headers),
        remoteAddress: req.ip,
        remotePort: req.socket?.remotePort,
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: redactSensitiveFields(res.getHeaders?.()),
      }),
    },
  };

  // Development: Use pino-pretty for human-readable logs
  if (isDev) {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true,
        },
      },
    };
  }

  // Production: Use Axiom transport if configured
  if (isProd && env.AXIOM_DATASET && env.AXIOM_TOKEN) {
    return {
      ...baseConfig,
      transport: {
        target: '@axiomhq/pino',
        options: {
          dataset: env.AXIOM_DATASET,
          token: env.AXIOM_TOKEN,
        },
      },
    };
  }

  // Fallback: JSON to stdout (for production without Axiom)
  return baseConfig;
};

/**
 * Create standalone logger instance for use outside Fastify (worker, collab server)
 */
export const createStandaloneLogger = () => {
  const config = getLoggerConfig();
  
  // Import pino dynamically to avoid circular dependencies
  const pino = require('pino');
  
  if ('transport' in config && config.transport) {
    return pino(
      { 
        level: config.level,
        redact: config.redact,
        serializers: config.serializers,
      },
      pino.transport(config.transport)
    );
  }
  
  return pino(config);
};
