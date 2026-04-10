/**
 * Get Pino logger configuration for Fastify
 * - Development: Pretty-printed console output
 * - Production: JSON format with optional Axiom transport
 */
export declare const getLoggerConfig: () => {
    level: "error" | "fatal" | "warn" | "info" | "debug" | "trace";
    redact: {
        paths: string[];
        censor: string;
    };
    serializers: {
        req: (req: any) => {
            id: any;
            method: any;
            url: any;
            headers: any;
            remoteAddress: any;
            remotePort: any;
        };
        res: (res: any) => {
            statusCode: any;
            headers: any;
        };
    };
} | {
    transport: {
        target: string;
        options: {
            translateTime: string;
            ignore: string;
            colorize: boolean;
            dataset?: undefined;
            token?: undefined;
        };
    };
    level: "error" | "fatal" | "warn" | "info" | "debug" | "trace";
    redact: {
        paths: string[];
        censor: string;
    };
    serializers: {
        req: (req: any) => {
            id: any;
            method: any;
            url: any;
            headers: any;
            remoteAddress: any;
            remotePort: any;
        };
        res: (res: any) => {
            statusCode: any;
            headers: any;
        };
    };
} | {
    transport: {
        target: string;
        options: {
            dataset: string;
            token: string;
            translateTime?: undefined;
            ignore?: undefined;
            colorize?: undefined;
        };
    };
    level: "error" | "fatal" | "warn" | "info" | "debug" | "trace";
    redact: {
        paths: string[];
        censor: string;
    };
    serializers: {
        req: (req: any) => {
            id: any;
            method: any;
            url: any;
            headers: any;
            remoteAddress: any;
            remotePort: any;
        };
        res: (res: any) => {
            statusCode: any;
            headers: any;
        };
    };
};
/**
 * Create standalone logger instance for use outside Fastify (worker, collab server)
 */
export declare const createStandaloneLogger: () => any;
//# sourceMappingURL=logger.d.ts.map