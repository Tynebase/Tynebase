"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = contactRoutes;
const email_1 = require("../services/email");
async function contactRoutes(fastify) {
    fastify.post('/api/contact', async (request, reply) => {
        try {
            const body = request.body;
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
            const emailSent = await (0, email_1.sendContactFormEmail)({
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Internal server error',
            });
        }
    });
}
//# sourceMappingURL=contact.js.map