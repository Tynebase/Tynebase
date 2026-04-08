/**
 * Credit calculation utilities for TyneBase operations
 * Pricing (v2 — March 2026):
 *   DeepSeek 0.2 · Gemini 1 · Claude 2
 *   Media base: 5 (Gemini/DeepSeek) or 6 (Claude)
 */

export type OperationType = 
  | 'text_generation'
  | 'rag_question'
  | 'enhance'
  | 'video_ingestion'
  | 'audio_ingestion'
  | 'media_ingestion'
  | 'url_conversion'
  | 'pdf_conversion';

export type AIModel = 
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'deepseek-v3'
  | 'deepseek'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-sonnet-4.5'
  | 'claude'
  | 'gemini-2.5-flash'
  | 'gemini-2.5'
  | 'gemini'
  | 'gemini-3-flash';

/**
 * Model credit costs (v2 pricing)
 * - DeepSeek: 0.2 credits (cheapest, great for bulk ops)
 * - Gemini: 1 credit (good balance of cost/quality)
 * - Claude: 2 credits (highest quality)
 */
const MODEL_CREDITS: Record<string, number> = {
  // DeepSeek models: 0.2 credits
  'deepseek-v3': 0.2,
  'deepseek': 0.2,
  
  // Gemini models: 1 credit
  'gemini-2.5-flash': 1,
  'gemini-2.5': 1,
  'gemini': 1,
  'gemini-3-flash': 1,
  
  // Claude models: 2 credits
  'claude-sonnet-4.5': 2,
  'claude-3-sonnet': 2,
  'claude-3-opus': 2,
  'claude-3-haiku': 1,
  'claude': 2,
  
  // GPT models (legacy): 1 credit
  'gpt-4': 1,
  'gpt-4-turbo': 1,
  'gpt-3.5-turbo': 0.2,
};

/**
 * Get credit cost for a model
 * @param model - AI model name
 * @returns Credit cost (defaults to 0.2 if unknown)
 */
export function getModelCreditCost(model: string): number {
  return MODEL_CREDITS[model] ?? 0.2;
}

/**
 * Model multipliers (kept for backward compat, mirrors MODEL_CREDITS)
 */
const MODEL_MULTIPLIERS: Record<string, number> = {
  'deepseek-v3': 0.2,
  'deepseek': 0.2,
  'gemini-2.5-flash': 1,
  'gemini-2.5': 1,
  'gemini': 1,
  'claude-sonnet-4.5': 2,
  'claude': 2,
};

/**
 * Base credits for media ingestion (video/audio)
 * 5 for Gemini/DeepSeek transcription, 6 if Claude is used for final doc
 */
const MEDIA_BASE_CREDITS_STANDARD = 5;
const MEDIA_BASE_CREDITS_CLAUDE = 6;

/**
 * Minutes of media before additional credits are charged
 * After 10 minutes, add 1 credit per 5 additional minutes
 */
const MEDIA_FREE_MINUTES = 10;
const MEDIA_EXTRA_MINUTES_PER_CREDIT = 5;

/**
 * Calculate credits for text generation based on model
 * Uses fixed credit costs per model:
 * - DeepSeek: 0.2 credits
 * - Gemini: 1 credit
 * - Claude: 2 credits
 * 
 * @param _inputTokens - Number of input tokens (unused, kept for API compatibility)
 * @param _outputTokens - Number of output tokens (unused, kept for API compatibility)
 * @param model - AI model being used
 * @returns Number of credits to deduct
 */
export function calculateTextGenerationCredits(
  _inputTokens: number,
  _outputTokens: number,
  model: AIModel = 'deepseek'
): number {
  return getModelCreditCost(model);
}

/**
 * Calculate credits for RAG question based on model
 * @param model - AI model being used
 * @returns Number of credits to deduct based on model
 */
export function calculateRAGQuestionCredits(model: AIModel = 'deepseek'): number {
  return getModelCreditCost(model);
}

/**
 * Calculate credits for document enhancement based on model
 * @param model - AI model being used
 * @returns Number of credits to deduct based on model
 */
export function calculateEnhanceCredits(model: AIModel = 'claude'): number {
  return getModelCreditCost(model);
}

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
export function calculateVideoIngestionCredits(
  durationMinutes: number,
  outputOptions?: MediaOutputOptions,
  model?: string
): number {
  const isClaudeOutput = model ? model.includes('claude') : false;
  let credits = isClaudeOutput ? MEDIA_BASE_CREDITS_CLAUDE : MEDIA_BASE_CREDITS_STANDARD;
  
  // Add per-model cost for each output option
  const modelCost = model ? getModelCreditCost(model) : 1;
  if (outputOptions) {
    if (outputOptions.generate_transcript) credits += modelCost;
    if (outputOptions.generate_summary) credits += modelCost;
    if (outputOptions.generate_article) credits += modelCost;
  }
  
  // Add credits for excessive length (beyond 10 minutes)
  if (durationMinutes > MEDIA_FREE_MINUTES) {
    const extraMinutes = durationMinutes - MEDIA_FREE_MINUTES;
    const extraCredits = Math.ceil(extraMinutes / MEDIA_EXTRA_MINUTES_PER_CREDIT);
    credits += extraCredits;
  }
  
  return credits;
}

/**
 * Calculate credits for audio ingestion
 * Same pricing as video ingestion
 * 
 * @param durationMinutes - Audio duration in minutes
 * @param outputOptions - Optional output options for extra credits
 * @returns Number of credits to deduct
 */
export function calculateAudioIngestionCredits(
  durationMinutes: number,
  outputOptions?: MediaOutputOptions,
  model?: string
): number {
  return calculateVideoIngestionCredits(durationMinutes, outputOptions, model);
}

/**
 * Calculate credits for media ingestion (unified video/audio)
 * 
 * @param durationMinutes - Media duration in minutes
 * @param outputOptions - Optional output options for extra credits
 * @returns Number of credits to deduct
 */
export function calculateMediaIngestionCredits(
  durationMinutes: number,
  outputOptions?: MediaOutputOptions,
  model?: string
): number {
  return calculateVideoIngestionCredits(durationMinutes, outputOptions, model);
}

/**
 * Calculate credits for URL conversion (flat rate)
 * @returns Number of credits to deduct (always 0.5)
 */
export function calculateURLConversionCredits(): number {
  return 0.5;
}

/**
 * Calculate credits for PDF conversion (flat rate)
 * @returns Number of credits to deduct (always 0.5)
 */
export function calculatePDFConversionCredits(): number {
  return 0.5;
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
    outputOptions?: MediaOutputOptions;
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
      return calculateVideoIngestionCredits(params.durationMinutes, params.outputOptions);

    case 'audio_ingestion':
      if (params.durationMinutes === undefined) {
        throw new Error('durationMinutes is required for audio_ingestion');
      }
      return calculateAudioIngestionCredits(params.durationMinutes, params.outputOptions);

    case 'media_ingestion':
      if (params.durationMinutes === undefined) {
        throw new Error('durationMinutes is required for media_ingestion');
      }
      return calculateMediaIngestionCredits(params.durationMinutes, params.outputOptions);

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
