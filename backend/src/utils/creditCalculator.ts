/**
 * Credit calculation utilities for TyneBase operations
 * Based on pricing model: 1 credit per 200k tokens, with model multipliers
 */

export type OperationType = 
  | 'text_generation'
  | 'rag_question'
  | 'enhance'
  | 'video_ingestion'
  | 'url_conversion'
  | 'pdf_conversion';

export type AIModel = 
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'deepseek-v3'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-sonnet-4.5'
  | 'gemini-3-flash';

/**
 * Model multipliers for premium models
 */
const MODEL_MULTIPLIERS: Record<string, number> = {
  'deepseek-v3': 1.5,
  'claude-sonnet-4.5': 2,
};

/**
 * Base tokens per credit (200,000 tokens = 1 credit)
 */
const TOKENS_PER_CREDIT = 200000;

/**
 * Minutes of video per credit (5 minutes = 1 credit)
 */
const VIDEO_MINUTES_PER_CREDIT = 5;

/**
 * Calculate credits for text generation based on token count
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - AI model being used
 * @returns Number of credits to deduct (minimum 1)
 */
export function calculateTextGenerationCredits(
  inputTokens: number,
  outputTokens: number,
  model: AIModel = 'gpt-4'
): number {
  const totalTokens = inputTokens + outputTokens;
  const baseCredits = Math.ceil(totalTokens / TOKENS_PER_CREDIT);
  const multiplier = MODEL_MULTIPLIERS[model] || 1;
  const finalCredits = Math.ceil(baseCredits * multiplier);
  
  return Math.max(1, finalCredits);
}

/**
 * Calculate credits for RAG question (flat rate)
 * @param model - AI model being used
 * @returns Number of credits to deduct (always 1, with multiplier)
 */
export function calculateRAGQuestionCredits(model: AIModel = 'gpt-4'): number {
  const multiplier = MODEL_MULTIPLIERS[model] || 1;
  return Math.ceil(1 * multiplier);
}

/**
 * Calculate credits for document enhancement (flat rate)
 * @param model - AI model being used
 * @returns Number of credits to deduct (always 1, with multiplier)
 */
export function calculateEnhanceCredits(model: AIModel = 'gpt-4'): number {
  const multiplier = MODEL_MULTIPLIERS[model] || 1;
  return Math.ceil(1 * multiplier);
}

/**
 * Calculate credits for video ingestion
 * @param durationMinutes - Video duration in minutes
 * @returns Number of credits to deduct (1 credit per 5 minutes, minimum 1)
 */
export function calculateVideoIngestionCredits(durationMinutes: number): number {
  const credits = Math.ceil(durationMinutes / VIDEO_MINUTES_PER_CREDIT);
  return Math.max(1, credits);
}

/**
 * Calculate credits for URL conversion (flat rate)
 * @returns Number of credits to deduct (always 1)
 */
export function calculateURLConversionCredits(): number {
  return 1;
}

/**
 * Calculate credits for PDF conversion (flat rate)
 * @returns Number of credits to deduct (always 1)
 */
export function calculatePDFConversionCredits(): number {
  return 1;
}

/**
 * Universal credit calculator - determines operation type and calculates credits
 * @param operation - Type of operation
 * @param params - Operation-specific parameters
 * @returns Number of credits to deduct
 */
export function calculateCredits(
  operation: OperationType,
  params: {
    inputTokens?: number;
    outputTokens?: number;
    durationMinutes?: number;
    model?: AIModel;
  }
): number {
  switch (operation) {
    case 'text_generation':
      if (params.inputTokens === undefined || params.outputTokens === undefined) {
        throw new Error('inputTokens and outputTokens are required for text_generation');
      }
      return calculateTextGenerationCredits(
        params.inputTokens,
        params.outputTokens,
        params.model
      );

    case 'rag_question':
      return calculateRAGQuestionCredits(params.model);

    case 'enhance':
      return calculateEnhanceCredits(params.model);

    case 'video_ingestion':
      if (params.durationMinutes === undefined) {
        throw new Error('durationMinutes is required for video_ingestion');
      }
      return calculateVideoIngestionCredits(params.durationMinutes);

    case 'url_conversion':
      return calculateURLConversionCredits();

    case 'pdf_conversion':
      return calculatePDFConversionCredits();

    default:
      throw new Error(`Unknown operation type: ${operation}`);
  }
}

/**
 * Estimate credits for text generation before execution
 * Useful for pre-flight checks
 * @param inputTokens - Number of input tokens
 * @param estimatedOutputTokens - Estimated output tokens
 * @param model - AI model being used
 * @returns Estimated number of credits
 */
export function estimateTextGenerationCredits(
  inputTokens: number,
  estimatedOutputTokens: number,
  model: AIModel = 'gpt-4'
): number {
  return calculateTextGenerationCredits(inputTokens, estimatedOutputTokens, model);
}

/**
 * Get model multiplier for a given model
 * @param model - AI model name
 * @returns Multiplier value (1 if no multiplier)
 */
export function getModelMultiplier(model: AIModel): number {
  return MODEL_MULTIPLIERS[model] || 1;
}
