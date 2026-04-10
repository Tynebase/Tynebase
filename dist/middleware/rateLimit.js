"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
exports.getRateLimitStats = getRateLimitStats;
exports.clearRateLimitStore = clearRateLimitStore;
exports.loginRateLimitMiddleware = loginRateLimitMiddleware;
const globalConfig = {
    windowMs: 10 * 60 * 1000,
    maxRequests: 2000, // Production: ~200 req/min per user, supports 100+ concurrent users
};
const aiConfig = {
    windowMs: 60 * 1000,
    maxRequests: 60, // Production: 60 AI requests per minute per user
};
const loginConfig = {
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000, // Temporarily increased for testing multi-tenant auth issues
};
const rateLimitStore = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const ENTRY_TTL = 15 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    const keysToDelete = [];
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
function getRateLimitKey(userId, ip) {
    return userId ? `user:${userId}` : `ip:${ip}`;
}
function cleanOldTimestamps(timestamps, windowMs, now) {
    return timestamps.filter(ts => now - ts < windowMs);
}
function isRateLimited(key, config, now) {
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
async function rateLimitMiddleware(request, reply) {
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
        reply.header('Retry-After', result.retryAfter.toString());
        request.log.warn({
            userId,
            ip,
            path,
            limit: config.maxRequests,
            window: config.windowMs / 1000,
            retryAfter: result.retryAfter,
        }, 'Rate limit exceeded');
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
    request.log.debug({
        userId,
        ip,
        path,
        current: result.current,
        limit: config.maxRequests,
    }, 'Rate limit check passed');
}
function getRateLimitStats() {
    return {
        totalKeys: rateLimitStore.size,
        entries: Array.from(rateLimitStore.entries()).map(([key, entry]) => ({
            key,
            requestCount: entry.timestamps.length,
            lastActivity: new Date(entry.lastCleanup).toISOString(),
        })),
    };
}
function clearRateLimitStore() {
    rateLimitStore.clear();
}
async function loginRateLimitMiddleware(request, reply) {
    const now = Date.now();
    const ip = request.ip || 'unknown';
    const key = `ip:${ip}`;
    const result = isRateLimited(key, loginConfig, now);
    reply.header('X-RateLimit-Limit', loginConfig.maxRequests.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Window', (loginConfig.windowMs / 1000).toString());
    if (result.limited) {
        reply.header('Retry-After', result.retryAfter.toString());
        request.log.warn({
            ip,
            path: request.url,
            limit: loginConfig.maxRequests,
            window: loginConfig.windowMs / 1000,
            retryAfter: result.retryAfter,
        }, 'Login rate limit exceeded');
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
    request.log.debug({
        ip,
        path: request.url,
        current: result.current,
        limit: loginConfig.maxRequests,
    }, 'Login rate limit check passed');
}
//# sourceMappingURL=rateLimit.js.map