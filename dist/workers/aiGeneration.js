"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAIGenerationJob = processAIGenerationJob;
const supabase_1 = require("../lib/supabase");
const bedrock_1 = require("../services/ai/bedrock");
const anthropic_1 = require("../services/ai/anthropic");
const vertex_1 = require("../services/ai/vertex");
const completeJob_1 = require("../utils/completeJob");
const failJob_1 = require("../utils/failJob");
const zod_1 = require("zod");
const AIGenerationPayloadSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1),
    model: zod_1.z.enum(['deepseek', 'claude', 'gemini']),
    max_tokens: zod_1.z.number().int().positive().optional(),
    output_types: zod_1.z.array(zod_1.z.enum(['full_article', 'summary', 'outline', 'with_template'])).min(1).optional().default(['full_article']),
    template_content: zod_1.z.string().optional(),
    user_id: zod_1.z.string().uuid(),
    estimated_credits: zod_1.z.number().int().positive(),
    skip_document_creation: zod_1.z.boolean().optional().default(false),
});
/**
 * Process an AI generation job
 * @param job - Job record from job_queue
 */
async function processAIGenerationJob(job) {
    const workerId = job.worker_id;
    console.log(`[Worker ${workerId}] Processing AI generation job ${job.id}`);
    console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}, Model: ${job.payload.model}`);
    try {
        const validated = AIGenerationPayloadSchema.parse(job.payload);
        const outputTypes = validated.output_types || ['full_article'];
        const skipDocumentCreation = validated.skip_document_creation || false;
        console.log(`[Worker ${workerId}] Generating ${outputTypes.length} output(s): ${outputTypes.join(', ')}${skipDocumentCreation ? ' (content only, no document)' : ''}`);
        const OUTPUT_TYPE_LABELS = {
            full_article: 'Article',
            summary: 'Summary',
            outline: 'Outline',
            with_template: 'From Template',
        };
        const documentIds = [];
        const generatedContents = [];
        let firstDocId = null;
        let firstTitle = null;
        let totalTokensInput = 0;
        let totalTokensOutput = 0;
        let lastProvider = '';
        let lastModel = null;
        for (const outputType of outputTypes) {
            console.log(`[Worker ${workerId}] Generating output type: ${outputType}`);
            const generatedContent = await callAIProvider(validated.prompt, validated.model, validated.max_tokens || 8000, outputType, validated.template_content);
            console.log(`[Worker ${workerId}] AI generation completed for ${outputType}. Content length: ${generatedContent.content?.length || 0}`);
            const sanitizedContent = sanitizeAIOutput(generatedContent.content);
            generatedContents.push(sanitizedContent);
            totalTokensInput += generatedContent.tokensInput;
            totalTokensOutput += generatedContent.tokensOutput;
            lastProvider = generatedContent.provider;
            lastModel = generatedContent.model;
            // Skip document creation if flag is set (e.g., for template content generation)
            if (skipDocumentCreation) {
                console.log(`[Worker ${workerId}] Skipping document creation for ${outputType} (content-only mode)`);
                continue;
            }
            const baseTitle = generateDocumentTitle(validated.prompt, sanitizedContent);
            const documentTitle = outputTypes.length > 1
                ? `${baseTitle} — ${OUTPUT_TYPE_LABELS[outputType] || outputType}`
                : baseTitle;
            // NOTE: We intentionally do NOT save yjs_state here.
            // The collab server will initialize the Y.js document from the markdown content
            // using initializeYdocFromContent() which properly parses markdown into TipTap nodes
            // (headings, lists, blockquotes, etc.) for beautiful rich text rendering.
            const { data: document, error: docError } = await supabase_1.supabaseAdmin
                .from('documents')
                .insert({
                tenant_id: job.tenant_id,
                title: documentTitle,
                content: sanitizedContent,
                status: 'draft',
                author_id: validated.user_id,
            })
                .select()
                .single();
            if (docError) {
                console.error(`[Worker ${workerId}] Failed to create document for ${outputType}:`, docError);
                continue;
            }
            console.log(`[Worker ${workerId}] Document created: ${document.id} (${outputType})`);
            documentIds.push(document.id);
            if (!firstDocId) {
                firstDocId = document.id;
                firstTitle = document.title;
            }
            const { error: lineageError } = await supabase_1.supabaseAdmin
                .from('document_lineage')
                .insert({
                document_id: document.id,
                event_type: 'ai_generated',
                actor_id: validated.user_id,
                metadata: {
                    model: validated.model,
                    provider: generatedContent.provider,
                    prompt_length: validated.prompt.length,
                    output_length: sanitizedContent.length,
                    output_type: outputType,
                },
            });
            if (lineageError) {
                console.error(`[Worker ${workerId}] Failed to create lineage event:`, lineageError);
            }
        }
        // For content-only mode, we don't require documents to be created
        if (!skipDocumentCreation && documentIds.length === 0) {
            await (0, failJob_1.failJob)({
                jobId: job.id,
                error: 'Failed to create any documents',
            });
            return;
        }
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { error: usageError } = await supabase_1.supabaseAdmin
            .from('query_usage')
            .insert({
            tenant_id: job.tenant_id,
            user_id: validated.user_id,
            query_type: 'text_generation',
            ai_model: validated.model,
            tokens_input: totalTokensInput,
            tokens_output: totalTokensOutput,
            credits_charged: validated.estimated_credits,
            month_year: currentMonth,
            metadata: {
                job_id: job.id,
                document_ids: documentIds,
                output_types: outputTypes,
                content_only: skipDocumentCreation,
            },
        });
        if (usageError) {
            console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
        }
        else {
            console.log(`[Worker ${workerId}] Query usage logged: ${totalTokensInput + totalTokensOutput} tokens`);
        }
        await (0, completeJob_1.completeJob)({
            jobId: job.id,
            result: {
                document_id: firstDocId,
                document_ids: documentIds,
                title: firstTitle,
                output_types: outputTypes,
                documents_created: documentIds.length,
                tokens_input: totalTokensInput,
                tokens_output: totalTokensOutput,
                model: lastModel,
                provider: lastProvider,
                // Include generated content when in content-only mode
                content: skipDocumentCreation ? generatedContents[0] : undefined,
                contents: skipDocumentCreation && generatedContents.length > 1 ? generatedContents : undefined,
            },
        });
        console.log(`[Worker ${workerId}] Job ${job.id} completed successfully${skipDocumentCreation ? ' (content only)' : ` — ${documentIds.length} document(s) created`}`);
    }
    catch (error) {
        console.error(`[Worker ${workerId}] Error processing AI generation job:`, error);
        await (0, failJob_1.failJob)({
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorDetails: {
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
                timestamp: new Date().toISOString(),
            },
        });
    }
}
/**
 * Call the appropriate AI provider based on model
 * @param prompt - User prompt
 * @param model - AI model name
 * @param maxTokens - Maximum tokens to generate
 * @param outputType - Desired output format
 * @param templateContent - Optional template structure to follow
 * @returns Generated content with token counts
 */
/**
 * Builds a dynamic system prompt based on the requested output type and optional template.
 */
function buildSystemPrompt(outputType, templateContent) {
    const baseRules = `CRITICAL RULES:
- Generate the requested content IMMEDIATELY and IN FULL. Do NOT ask clarifying questions, do NOT engage in conversation, and do NOT request more information.
- Write as the author, not an assistant having a chat.
- Make reasonable assumptions where details are not provided. Fill in professional, realistic content rather than asking the user.
- Do NOT include meta-commentary like "Here is your document" or "I'd be happy to help". Just output the content directly.`;
    switch (outputType) {
        case 'summary':
            return `You are a professional content summarizer. Your task is to generate a concise, well-structured summary based on the user's request.

${baseRules}
- ALWAYS start with a single H1 heading (# Title) that is a concise, descriptive title for the document (NOT the user's prompt verbatim). This title should capture the essence of the content.
- Focus on key points, main themes, and critical takeaways.
- Organize the summary into clear sections with headings.
- Use Markdown formatting: headings (##, ###), bullet points, **bold** for emphasis.
- Keep it concise but comprehensive — capture all essential information.
- The output should be a ready-to-use summary document.`;
        case 'outline':
            return `You are a professional document planner. Your task is to generate a detailed hierarchical outline based on the user's request.

${baseRules}
- ALWAYS start with a single H1 heading (# Title) that is a concise, descriptive title for the document (NOT the user's prompt verbatim). This title should capture the essence of the content.
- Create a structured outline with main topics as top-level headings.
- Use nested bullet points for sub-topics and key details.
- Include brief annotations or notes under each section describing what should be covered.
- Use Markdown formatting: headings (#, ##, ###) for main sections, bullet points (-, *) for sub-items.
- The output should be a complete outline that could serve as a blueprint for a full document.`;
        case 'with_template':
            return `You are a professional document writer. Your task is to generate complete document content by following the provided template structure.

${baseRules}
- ALWAYS start with a single H1 heading (# Title) that is a concise, descriptive title for the document (NOT the user's prompt verbatim). This title should capture the essence of the content.
- You MUST follow the template structure provided below. Use its headings, sections, and organization as your guide.
- Fill in every section of the template with substantive, relevant content based on the user's request.
- Replace any placeholder text (e.g., [brackets]) with actual professional content.
- Use Markdown formatting consistent with the template.
- Do NOT skip sections — populate every part of the template.
${templateContent ? `\nTEMPLATE STRUCTURE TO FOLLOW:\n\n${templateContent}` : ''}`;
        case 'full_article':
        default:
            return `You are a professional document writer. Your task is to generate complete, well-structured document content based on the user's request.

${baseRules}
- ALWAYS start with a single H1 heading (# Title) that is a concise, descriptive title for the document (NOT the user's prompt verbatim). This title should capture the essence of the content.
- Use Markdown formatting: headings (#, ##, ###), bullet points, numbered lists, bold, italic, etc.
- Create a comprehensive, publication-ready document with a clear introduction, well-organized body sections, and a conclusion if appropriate.
- The output should be a complete, ready-to-use document.`;
    }
}
async function callAIProvider(prompt, model, maxTokens, outputType = 'full_article', templateContent) {
    const timeout = 60000;
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI generation timed out after 60 seconds')), timeout);
    });
    // Map simplified model names to actual model IDs
    const modelMap = {
        'deepseek': 'deepseek-v3',
        'claude': 'claude-sonnet-4.5',
        'gemini': 'gemini-2.5-flash',
    };
    const actualModel = modelMap[model];
    if (!actualModel) {
        throw new Error(`Unsupported model: ${model}`);
    }
    const systemPrompt = buildSystemPrompt(outputType, templateContent);
    const requestBase = {
        prompt,
        model: actualModel,
        maxTokens,
        systemPrompt,
    };
    // Route to appropriate provider based on model
    if (model === 'deepseek') {
        // DeepSeek via AWS Bedrock
        const result = await Promise.race([
            (0, bedrock_1.generateText)(requestBase),
            timeoutPromise,
        ]);
        return result;
    }
    else if (model === 'claude') {
        // Claude via AWS Bedrock (Anthropic service)
        const result = await Promise.race([
            (0, anthropic_1.generateText)(requestBase),
            timeoutPromise,
        ]);
        return result;
    }
    else if (model === 'gemini') {
        // Gemini 2.0 via Google Vertex AI
        const result = await Promise.race([
            (0, vertex_1.generateText)(requestBase),
            timeoutPromise,
        ]);
        return result;
    }
    else {
        throw new Error(`Unsupported model: ${model}`);
    }
}
/**
 * Sanitize AI output to prevent XSS and injection attacks
 * @param content - Raw AI-generated content
 * @returns Sanitized content
 */
function sanitizeAIOutput(content) {
    if (!content || typeof content !== 'string') {
        return '';
    }
    let sanitized = content.trim();
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    if (sanitized.length > 100000) {
        sanitized = sanitized.substring(0, 100000);
        console.warn('[sanitizeAIOutput] Content truncated to 100,000 characters');
    }
    return sanitized;
}
/**
 * Generate a document title from the prompt and content
 * @param prompt - Original user prompt
 * @param content - Generated content
 * @returns Document title (max 100 chars)
 */
function generateDocumentTitle(prompt, content) {
    const firstLine = content.split('\n')[0]?.trim() || '';
    if (firstLine.startsWith('#')) {
        const title = firstLine.replace(/^#+\s*/, '').trim();
        if (title.length > 0 && title.length <= 100) {
            return title;
        }
    }
    const promptTitle = prompt.length <= 80
        ? prompt
        : prompt.substring(0, 77) + '...';
    return `AI Generated: ${promptTitle}`;
}
//# sourceMappingURL=aiGeneration.js.map