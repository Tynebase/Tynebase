import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';

/**
 * Error handler middleware
 * Logs errors with full context (stack trace, user info, request details)
 * Returns generic error messages to clients (never expose internal details)
 * 
 * Security:
 * - Stack traces logged internally, never sent to client
 * - Generic error messages for 500 errors
 * - User context logged for audit trail
 * - Sensitive data redacted from logs
 * 
 * Logged Fields:
 * - error_type: Error class name
 * - error_message: Error message
 * - error_code: Error code (if available)
 * - stack_trace: Full stack trace (internal only)
 * - method: HTTP method
 * - path: Request URL path
 * - user_id: Authenticated user ID (if available)
 * - tenant_id: Tenant ID (if available)
 * - ip: Client IP address
 * - request_id: Unique request identifier
 * - timestamp: Error occurrence time
 */
export const errorHandler = async (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Extract user and tenant context if available
  const user = (request as any).user;
  const tenant = (request as any).tenant;

  // Determine error type and status code
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isServerError = statusCode >= 500;

  // Build error context for logging
  const errorContext = {
    type: 'error',
    error_type: error.constructor.name,
    error_message: error.message,
    error_code: error.code || null,
    status_code: statusCode,
    method: request.method,
    path: request.url,
    user_id: user?.id || null,
    tenant_id: tenant?.id || null,
    ip: request.ip,
    request_id: request.id,
    timestamp: new Date().toISOString(),
    // Include stack trace for server errors (internal logging only)
    stack_trace: isServerError ? error.stack : null,
    // Include request body for debugging (sanitized)
    request_body: isServerError ? sanitizeRequestBody(request.body) : null,
    // Include query params for debugging
    query_params: isServerError ? request.query : null,
  };

  // Log error with appropriate level
  if (isServerError) {
    request.log.error(errorContext, 'Internal server error occurred');
  } else if (isClientError) {
    request.log.warn(errorContext, 'Client error occurred');
  } else {
    request.log.error(errorContext, 'Unexpected error occurred');
  }

  // Build client response (never expose internal details)
  const clientResponse = buildClientErrorResponse(error, statusCode, isServerError);

  // Send response
  reply.status(statusCode).send(clientResponse);
};

/**
 * Build error response for client
 * Never expose internal error details for server errors
 * @param error - Error object
 * @param statusCode - HTTP status code
 * @param isServerError - Whether this is a 5xx error
 * @returns Client-safe error response
 */
const buildClientErrorResponse = (
  error: FastifyError,
  statusCode: number,
  isServerError: boolean
) => {
  // For server errors (5xx), return generic message
  if (isServerError) {
    return {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred. Please try again later.',
        status: statusCode,
      },
    };
  }

  // For client errors (4xx), return specific message
  return {
    error: {
      code: error.code || 'CLIENT_ERROR',
      message: error.message || 'Bad request',
      status: statusCode,
      // Include validation details if available
      details: (error as any).validation || null,
    },
  };
};

/**
 * Sanitize request body for logging
 * Remove sensitive fields like passwords, tokens, API keys
 * @param body - Request body
 * @returns Sanitized body
 */
const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'authorization',
    'bearer',
    'access_token',
    'refresh_token',
    'private_key',
    'privateKey',
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
};
