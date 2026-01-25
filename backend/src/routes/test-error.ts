import { FastifyPluginAsync } from 'fastify';

/**
 * Test error endpoint to validate error handler
 * Throws various types of errors for testing
 */
const testErrorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Test 500 error - throws an internal server error
   */
  fastify.get('/api/test/error/500', async (_request, _reply) => {
    throw new Error('Test internal server error with sensitive password and api_key data');
  });

  /**
   * Test 400 error - throws a bad request error
   */
  fastify.get('/api/test/error/400', async (_request, _reply) => {
    const error: any = new Error('Invalid request parameters');
    error.statusCode = 400;
    throw error;
  });

  /**
   * Test 401 error - throws an unauthorized error
   */
  fastify.get('/api/test/error/401', async (_request, _reply) => {
    const error: any = new Error('Unauthorized access');
    error.statusCode = 401;
    throw error;
  });

  /**
   * Test error with validation details
   */
  fastify.post('/api/test/error/validation', async (_request, _reply) => {
    const error: any = new Error('Validation failed');
    error.statusCode = 422;
    error.validation = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Password too short' },
    ];
    throw error;
  });
};

export default testErrorRoutes;
