import { TiktokenModel } from 'tiktoken';
/**
 * Counts tokens in text using tiktoken for accurate OpenAI token counting
 * @param text - The text to count tokens for
 * @param model - The model to use for encoding (default: gpt-4)
 * @returns The number of tokens in the text
 */
export declare function countTokens(text: string, model?: TiktokenModel): number;
/**
 * Counts tokens for messages in chat format (for chat completion endpoints)
 * @param messages - Array of chat messages
 * @param model - The model to use for encoding (default: gpt-4)
 * @returns The number of tokens for the messages
 */
export declare function countMessageTokens(messages: Array<{
    role: string;
    content: string;
}>, model?: TiktokenModel): number;
/**
 * Estimates cost based on token count and model pricing
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The model being used
 * @returns Estimated cost in USD
 */
export declare function estimateCost(inputTokens: number, outputTokens: number, model: string): number;
//# sourceMappingURL=tokenCounter.d.ts.map