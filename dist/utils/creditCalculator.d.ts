/**
 * Credit calculation utilities for TyneBase operations
 * Pricing (v1 - reverted to whole numbers):
 *   DeepSeek 1 · Gemini 2 · Claude 5
 *   Media base: 5 (Gemini/DeepSeek) or 6 (Claude)
 */
export type OperationType = 'text_generation' | 'rag_question' | 'enhance' | 'video_ingestion' | 'audio_ingestion' | 'media_ingestion' | 'url_conversion' | 'pdf_conversion';
export type AIModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'deepseek-v3' | 'deepseek' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-sonnet-4.5' | 'claude' | 'gemini-2.5-flash' | 'gemini-2.5' | 'gemini' | 'gemini-3-flash';
/**
 * Get credit cost for a model
 * @param model - AI model name
 * @returns Credit cost (defaults to 1 if unknown)
 */
export declare function getModelCreditCost(model: string): number;
/**
 * Calculate credits for text generation based on model
 * Uses fixed credit costs per model:
 * - DeepSeek: 1 credit
 * - Gemini: 2 credits
 * - Claude: 5 credits
 *
 * @param _inputTokens - Number of input tokens (unused, kept for API compatibility)
 * @param _outputTokens - Number of output tokens (unused, kept for API compatibility)
 * @param model - AI model being used
 * @returns Number of credits to deduct
 */
export declare function calculateTextGenerationCredits(_inputTokens: number, _outputTokens: number, model?: AIModel): number;
/**
 * Calculate credits for RAG question based on model
 * @param model - AI model being used
 * @returns Number of credits to deduct based on model
 */
export declare function calculateRAGQuestionCredits(model?: AIModel): number;
/**
 * Calculate credits for document enhancement based on model
 * @param model - AI model being used
 * @returns Number of credits to deduct based on model
 */
export declare function calculateEnhanceCredits(model?: AIModel): number;
/**
 * Output options for media ingestion
 */
export interface MediaOutputOptions {
    generate_transcript?: boolean;
    generate_summary?: boolean;
    generate_article?: boolean;
}
/**
 * Calculate credits for video ingestion
 * Base: 5 credits (Gemini/DeepSeek) or 6 credits (Claude)
 * Each output option (transcript, summary, article): + model cost
 * After 10 minutes: +1 credit per 5 additional minutes
 *
 * @param durationMinutes - Video duration in minutes
 * @param outputOptions - Optional output options for extra credits
 * @param model - AI model used for output generation
 * @returns Number of credits to deduct
 */
export declare function calculateVideoIngestionCredits(durationMinutes: number, outputOptions?: MediaOutputOptions, model?: string): number;
/**
 * Calculate credits for audio ingestion
 * Same pricing as video ingestion
 *
 * @param durationMinutes - Audio duration in minutes
 * @param outputOptions - Optional output options for extra credits
 * @returns Number of credits to deduct
 */
export declare function calculateAudioIngestionCredits(durationMinutes: number, outputOptions?: MediaOutputOptions, model?: string): number;
/**
 * Calculate credits for media ingestion (unified video/audio)
 *
 * @param durationMinutes - Media duration in minutes
 * @param outputOptions - Optional output options for extra credits
 * @returns Number of credits to deduct
 */
export declare function calculateMediaIngestionCredits(durationMinutes: number, outputOptions?: MediaOutputOptions, model?: string): number;
/**
 * Calculate credits for URL conversion (flat rate)
 * @returns Number of credits to deduct (always 1)
 */
export declare function calculateURLConversionCredits(): number;
/**
 * Calculate credits for PDF conversion (flat rate)
 * @returns Number of credits to deduct (always 1)
 */
export declare function calculatePDFConversionCredits(): number;
/**
 * Universal credit calculator - determines operation type and calculates credits
 * @param operation - Type of operation
 * @param params - Operation-specific parameters
 * @returns Number of credits to deduct
 */
export declare function calculateCredits(operation: OperationType, params: {
    inputTokens?: number;
    outputTokens?: number;
    durationMinutes?: number;
    model?: AIModel;
    outputOptions?: MediaOutputOptions;
}): number;
/**
 * Estimate credits for text generation before execution
 * Useful for pre-flight checks
 * @param inputTokens - Number of input tokens
 * @param estimatedOutputTokens - Estimated output tokens
 * @param model - AI model being used
 * @returns Estimated number of credits
 */
export declare function estimateTextGenerationCredits(inputTokens: number, estimatedOutputTokens: number, model?: AIModel): number;
/**
 * Get model multiplier for a given model
 * @param model - AI model name
 * @returns Multiplier value (1 if no multiplier)
 */
export declare function getModelMultiplier(model: AIModel): number;
//# sourceMappingURL=creditCalculator.d.ts.map