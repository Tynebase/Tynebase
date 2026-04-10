import { FastifyInstance } from 'fastify';
import { sendContactFormEmail } from '../services/email';

export default async function contactRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/contact',
    async (request, reply) => {
      try {
        const body = request.body as any;
        
        const { firstName, lastName, email, company, message } = body;

        // Validate required fields
        if (!email || !message) {
          return reply.status(400).send({
            success: false,
            error: 'Email and message are required',
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid email format',
          });
        }

        // Send email
        const emailSent = await sendContactFormEmail({
          firstName: firstName || '',
          lastName: lastName || '',
          email,
          company: company || '',
          message,
        });

        if (!emailSent) {
          return reply.status(500).send({
            success: false,
            error: 'Failed to send email',
          });
        }

        return reply.send({
          success: true,
          message: 'Message sent successfully',
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  );
}
