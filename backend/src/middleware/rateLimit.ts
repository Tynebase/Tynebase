import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const globalConfig: RateLimitConfig = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 100,
};

const aiConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

const loginConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
const ENTRY_TTL = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastCleanup > ENTRY_TTL) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    rateLimitStore.delete(key);
  }

  if (keysToDelete.length > 0) {
    console.log(`[RateLimit] Cleaned up ${keysToDelete.length} stale entries`);
  }
}, CLEANUP_INTERVAL);

function getRateLimitKey(userId: string | undefined, ip: string): string {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function cleanOldTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter(ts => now - ts < windowMs);
}

function isRateLimited(
  key: string,
  config: RateLimitConfig,
  now: number
): { limited: boolean; retryAfter?: number; current: number; remaining: number } {
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = {
      timestamps: [],
      lastCleanup: now,
    };
    rateLimitStore.set(key, entry);
  }

  entry.timestamps = cleanOldTimestamps(entry.timestamps, config.windowMs, now);
  entry.lastCleanup = now;

  const current = entry.timestamps.length;

  if (current >= config.maxRequests) {
    const oldestTimestamp = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
    return { limited: true, retryAfter, current, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { limited: false, current: current + 1, remaining: config.maxRequests - current - 1 };
}

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const now = Date.now();
  const userId = request.user?.id;
  const ip = request.ip || 'unknown';
  const path = request.url;

  const key = getRateLimitKey(userId, ip);

  const isAiEndpoint = path.startsWith('/api/ai');
  const isLoginEndpoint = path.startsWith('/api/auth/login');
  const config = isLoginEndpoint ? loginConfig : (isAiEndpoint ? aiConfig : globalConfig);

  const result = isRateLimited(key, config, now);

  reply.header('X-RateLimit-Limit', config.maxRequests.toString());
  reply.header('X-RateLimit-Remaining', result.remaining.toString());
  reply.header('X-RateLimit-Window', (config.windowMs / 1000).toString());

  if (result.limited) {
    reply.header('Retry-After', result.retryAfter!.toString());

    request.log.warn(
      {
        userId,
        ip,
        path,
        limit: config.maxRequests,
        window: config.windowMs / 1000,
        retryAfter: result.retryAfter,
      },
      'Rate limit exceeded'
    );

    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        limit: config.maxRequests,
        window: config.windowMs / 1000,
      },
    });
  }

  request.log.debug(
    {
      userId,
      ip,
      path,
      current: result.current,
      limit: config.maxRequests,
    },
    'Rate limit check passed'
  );
}

export function getRateLimitStats() {
  return {
    totalKeys: rateLimitStore.size,
    entries: Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
      key,
      requestCount: entry.timestamps.length,
      lastActivity: new Date(entry.lastCleanup).toISOString(),
    })),
  };
}

export function clearRateLimitStore() {
  rateLimitStore.clear();
}

export async function loginRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const now = Date.now();
  const ip = request.ip || 'unknown';
  const key = `ip:${ip}`;

  const result = isRateLimited(key, loginConfig, now);

  reply.header('X-RateLimit-Limit', loginConfig.maxRequests.toString());
  reply.header('X-RateLimit-Remaining', result.remaining.toString());
  reply.header('X-RateLimit-Window', (loginConfig.windowMs / 1000).toString());

  if (result.limited) {
    reply.header('Retry-After', result.retryAfter!.toString());

    request.log.warn(
      {
        ip,
        path: request.url,
        limit: loginConfig.maxRequests,
        window: loginConfig.windowMs / 1000,
        retryAfter: result.retryAfter,
      },
      'Login rate limit exceeded'
    );

    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many login attempts. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        limit: loginConfig.maxRequests,
        window: loginConfig.windowMs / 1000,
      },
    });
  }

  request.log.debug(
    {
      ip,
      path: request.url,
      current: result.current,
      limit: loginConfig.maxRequests,
    },
    'Login rate limit check passed'
  );
}
