import { FastifyInstance } from 'fastify';
/**
 * Valid activity types from the lineage_event_type enum
 */
declare const ACTIVITY_TYPES: readonly ["created", "ai_generated", "converted_from_video", "converted_from_pdf", "converted_from_docx", "converted_from_url", "published", "unpublished", "ai_enhanced", "edited"];
type ActivityType = typeof ACTIVITY_TYPES[number];
export interface ActivityItem {
    id: string;
    type: ActivityType;
    actor: {
        id: string | null;
        name: string;
        email: string | null;
    };
    target: {
        id: string;
        title: string;
    };
    detail: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}
export interface ActivityResponse {
    activities: ActivityItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}
/**
 * Knowledge Activity routes
 *
 * GET /api/knowledge/activity - List activity feed with pagination and filtering
 */
export default function knowledgeActivityRoutes(fastify: FastifyInstance): Promise<void>;
export {};
//# sourceMappingURL=knowledge-activity.d.ts.map