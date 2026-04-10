/**
 * AI Generation Worker
 * Processes ai_generation jobs from the job queue
 *
 * Workflow:
 * 1. Extract job payload (prompt, model, user_id, etc.)
 * 2. Call AI provider based on model selection
 * 3. Generate full content
 * 4. Create document with status: draft
 * 5. Create lineage event (type: ai_generated)
 * 6. Log query_usage with actual tokens
 * 7. Mark job as completed with document_id
 */
import { z } from 'zod';
declare const AIGenerationPayloadSchema: z.ZodObject<{
    prompt: z.ZodString;
    model: z.ZodEnum<["deepseek", "claude", "gemini"]>;
    max_tokens: z.ZodOptional<z.ZodNumber>;
    output_types: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<["full_article", "summary", "outline", "with_template"]>, "many">>>;
    template_content: z.ZodOptional<z.ZodString>;
    user_id: z.ZodString;
    estimated_credits: z.ZodNumber;
    skip_document_creation: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    prompt: string;
    model: "deepseek" | "gemini" | "claude";
    output_types: ("full_article" | "summary" | "outline" | "with_template")[];
    skip_document_creation: boolean;
    estimated_credits: number;
    max_tokens?: number | undefined;
    template_content?: string | undefined;
}, {
    user_id: string;
    prompt: string;
    model: "deepseek" | "gemini" | "claude";
    estimated_credits: number;
    max_tokens?: number | undefined;
    output_types?: ("full_article" | "summary" | "outline" | "with_template")[] | undefined;
    template_content?: string | undefined;
    skip_document_creation?: boolean | undefined;
}>;
type AIGenerationPayload = z.infer<typeof AIGenerationPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: AIGenerationPayload;
    worker_id: string;
}
/**
 * Process an AI generation job
 * @param job - Job record from job_queue
 */
export declare function processAIGenerationJob(job: Job): Promise<void>;
export {};
//# sourceMappingURL=aiGeneration.d.ts.map