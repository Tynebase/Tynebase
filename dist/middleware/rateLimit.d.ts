import { FastifyRequest, FastifyReply } from 'fastify';
export declare function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export declare function getRateLimitStats(): {
    totalKeys: number;
    entries: {
        key: string;
        requestCount: number;
        lastActivity: string;
    }[];
};
export declare function clearRateLimitStore(): void;
export declare function loginRateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
//# sourceMappingURL=rateLimit.d.ts.map