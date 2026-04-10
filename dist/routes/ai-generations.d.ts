import { FastifyInstance } from 'fastify';
export interface GenerationJob {
    id: string;
    title: string;
    type: 'From Prompt' | 'From URL' | 'From File' | 'Enhance' | 'Template';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
    document_id: string | null;
}
/**
 * Recent AI Generations listing endpoint
 * GET /api/ai/generations
 * Lists recent AI generation jobs for the tenant
 */
export default function recentGenerationsRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=ai-generations.d.ts.map