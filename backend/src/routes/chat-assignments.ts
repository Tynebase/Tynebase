import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

/**
 * Schemas
 */
const createAssignmentSchema = z.object({
  assigned_to: z.string().uuid(),
  assignment_type: z.enum(['document', 'task']),
  document_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  channel_id: z.string().uuid().optional(),
}).refine((data) => {
  if (data.assignment_type === 'document' && !data.document_id) {
    return false;
  }
  if (data.assignment_type === 'task' && !data.title) {
    return false;
  }
  return true;
}, {
  message: 'Document assignments require document_id, task assignments require title',
});

const updateAssignmentSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const listAssignmentsQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'all']).default('all'),
  type: z.enum(['document', 'task', 'all']).default('all'),
  assigned_to: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Chat Assignment Routes
 */
export default async function chatAssignmentRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/chat/assignments
   * List assignments for the tenant
   */
  fastify.get(
    '/api/chat/assignments',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const query = listAssignmentsQuerySchema.parse(request.query);

        let dbQuery = supabaseAdmin
          .from('chat_assignments')
          .select(`
            id,
            assignment_type,
            title,
            description,
            priority,
            status,
            due_date,
            created_at,
            updated_at,
            completed_at,
            document_id,
            channel_id,
            assigned_by_user:users!chat_assignments_assigned_by_fkey (
              id, full_name, email
            ),
            assigned_to_user:users!chat_assignments_assigned_to_fkey (
              id, full_name, email
            ),
            document:documents!chat_assignments_document_id_fkey (
              id, title
            )
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(query.limit);

        if (query.status !== 'all') {
          dbQuery = dbQuery.eq('status', query.status);
        }

        if (query.type !== 'all') {
          dbQuery = dbQuery.eq('assignment_type', query.type);
        }

        if (query.assigned_to) {
          dbQuery = dbQuery.eq('assigned_to', query.assigned_to);
        }

        const { data: assignments, error } = await dbQuery;

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch assignments');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch assignments' },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { assignments: assignments || [] },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/chat/assignments');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * GET /api/chat/assignments/my
   * List assignments assigned to the current user
   */
  fastify.get(
    '/api/chat/assignments/my',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const query = listAssignmentsQuerySchema.parse(request.query);

        let dbQuery = supabaseAdmin
          .from('chat_assignments')
          .select(`
            id,
            assignment_type,
            title,
            description,
            priority,
            status,
            due_date,
            created_at,
            updated_at,
            completed_at,
            document_id,
            channel_id,
            assigned_by_user:users!chat_assignments_assigned_by_fkey (
              id, full_name, email
            ),
            document:documents!chat_assignments_document_id_fkey (
              id, title
            )
          `)
          .eq('tenant_id', tenant.id)
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false })
          .limit(query.limit);

        if (query.status !== 'all') {
          dbQuery = dbQuery.eq('status', query.status);
        }

        if (query.type !== 'all') {
          dbQuery = dbQuery.eq('assignment_type', query.type);
        }

        const { data: assignments, error } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch my assignments');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch assignments' },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { assignments: assignments || [] },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in GET /api/chat/assignments/my');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * POST /api/chat/assignments
   * Create a new assignment (document or task)
   */
  fastify.post(
    '/api/chat/assignments',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const body = createAssignmentSchema.parse(request.body);

        // Verify assigned_to user is in the same tenant
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, full_name, email')
          .eq('id', body.assigned_to)
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .single();

        if (userError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'Assigned user not found in this workspace' },
          });
        }

        // If document assignment, verify document exists
        let docTitle = null;
        if (body.assignment_type === 'document' && body.document_id) {
          const { data: doc, error: docError } = await supabaseAdmin
            .from('documents')
            .select('id, title')
            .eq('id', body.document_id)
            .eq('tenant_id', tenant.id)
            .single();

          if (docError || !doc) {
            return reply.code(404).send({
              error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
            });
          }
          docTitle = doc.title;
        }

        // Create the assignment
        const { data: assignment, error: createError } = await supabaseAdmin
          .from('chat_assignments')
          .insert({
            tenant_id: tenant.id,
            channel_id: body.channel_id || null,
            assigned_by: user.id,
            assigned_to: body.assigned_to,
            assignment_type: body.assignment_type,
            document_id: body.document_id || null,
            title: body.assignment_type === 'task' ? body.title : docTitle,
            description: body.description || null,
            priority: body.priority,
            due_date: body.due_date || null,
          })
          .select(`
            id,
            assignment_type,
            title,
            description,
            priority,
            status,
            due_date,
            created_at,
            document_id,
            channel_id,
            assigned_by_user:users!chat_assignments_assigned_by_fkey (
              id, full_name, email
            ),
            assigned_to_user:users!chat_assignments_assigned_to_fkey (
              id, full_name, email
            ),
            document:documents!chat_assignments_document_id_fkey (
              id, title
            )
          `)
          .single();

        if (createError) {
          fastify.log.error({ error: createError }, 'Failed to create assignment');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to create assignment' },
          });
        }

        // If channel_id provided, also post a system message to the channel
        if (body.channel_id) {
          const assignmentLabel = body.assignment_type === 'document'
            ? `📄 Document assigned: "${docTitle}"`
            : `✅ Task assigned: "${body.title}"`;
          const systemContent = `${assignmentLabel}\nAssigned to: ${targetUser.full_name || targetUser.email}\nPriority: ${body.priority}${body.due_date ? `\nDue: ${body.due_date}` : ''}`;

          await supabaseAdmin
            .from('chat_messages')
            .insert({
              tenant_id: tenant.id,
              channel_id: body.channel_id,
              author_id: user.id,
              content: systemContent,
            });
        }

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: body.assignment_type === 'document' ? 'chat.document_assigned' : 'chat.task_assigned',
          actionType: 'chat',
          targetName: body.assignment_type === 'document' ? docTitle : body.title,
          ipAddress: getClientIp(request),
          metadata: {
            assignment_id: assignment.id,
            assigned_to: body.assigned_to,
            priority: body.priority,
          },
        });

        return reply.code(201).send({
          success: true,
          data: { assignment },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/chat/assignments');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * PATCH /api/chat/assignments/:id
   * Update assignment status/priority
   */
  fastify.patch(
    '/api/chat/assignments/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const { id } = request.params as { id: string };

        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment ID' },
          });
        }

        const body = updateAssignmentSchema.parse(request.body);
        const updateData: any = {};

        if (body.status !== undefined) {
          updateData.status = body.status;
          if (body.status === 'completed') {
            updateData.completed_at = new Date().toISOString();
          }
        }
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.due_date !== undefined) updateData.due_date = body.due_date;

        const { data: assignment, error } = await supabaseAdmin
          .from('chat_assignments')
          .update(updateData)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return reply.code(404).send({
              error: { code: 'NOT_FOUND', message: 'Assignment not found' },
            });
          }
          fastify.log.error({ error }, 'Failed to update assignment');
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to update assignment' },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { assignment },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/chat/assignments/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );
}
