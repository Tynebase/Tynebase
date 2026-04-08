import { encoding_for_model, TiktokenModel } from 'tiktoken';

/**
 * Counts tokens in text using tiktoken for accurate OpenAI token counting
 * @param text - The text to count tokens for
 * @param model - The model to use for encoding (default: gpt-4)
 * @returns The number of tokens in the text
 */
export function countTokens(text: string, model: TiktokenModel = 'gpt-4'): number {
  try {
    const encoding = encoding_for_model(model);
    const tokens = encoding.encode(text);
    const count = tokens.length;
    encoding.free();
    return count;
  } catch (error) {
    throw new Error(`Failed to count tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Counts tokens for messages in chat format (for chat completion endpoints)
 * @param messages - Array of chat messages
 * @param model - The model to use for encoding (default: gpt-4)
 * @returns The number of tokens for the messages
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  model: TiktokenModel = 'gpt-4'
): number {
  try {
    const encoding = encoding_for_model(model);
    let numTokens = 0;

    for (const message of messages) {
      numTokens += 4;
      numTokens += encoding.encode(message.role).length;
      numTokens += encoding.encode(message.content).length;
    }

    numTokens += 2;

    encoding.free();
    return numTokens;
  } catch (error) {
    throw new Error(`Failed to count message tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Estimates cost based on token count and model pricing
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The model being used
 * @returns Estimated cost in USD
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
    'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
    'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4'];
  return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
}
