"use strict";
/**
 * Anthropic Integration Service via AWS Bedrock
 * Handles text generation using Claude models through AWS Bedrock (eu-west-2)
 *
 * Features:
 * - Streaming support for real-time responses
 * - Automatic retry on throttling
 * - 30-second timeout
 * - Token counting for billing
 * - UK data residency compliance (eu-west-2)
 *
 * Supported Models:
 * - claude-sonnet-4.5 (balanced performance)
 * - claude-opus-4.5 (highest capability)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
exports.generateTextStream = generateTextStream;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const tokenCounter_1 = require("../../utils/tokenCounter");
/**
 * Bedrock client configured for EU region
 */
let bedrockClient = null;
/**
 * Model ID mapping for Bedrock
 * Using inference profile ARN for on-demand throughput support
 */
const BEDROCK_MODEL_IDS = {
    'claude-sonnet-4.5': 'arn:aws:bedrock:eu-west-2:659587467271:inference-profile/eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
};
/**
 * Initializes the Bedrock client with EU region
 * Uses IAM role credentials (recommended) or access keys
 * @throws Error if AWS credentials are not configured
 */
function getBedrockClient() {
    if (!bedrockClient) {
        // AWS SDK will automatically use credentials from:
        // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        // 2. IAM role (recommended for production)
        // 3. AWS credentials file (~/.aws/credentials)
        bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: 'eu-west-2', // UK region for data residency
            maxAttempts: 3, // Retry on transient failures
        });
    }
    return bedrockClient;
}
/**
 * Converts model name to Bedrock model ID
 * @param model - Model name (e.g., 'claude-sonnet-4.5')
 * @returns Bedrock model ID
 * @throws Error if model not supported
 */
function getBedrockModelId(model) {
    const modelId = BEDROCK_MODEL_IDS[model];
    if (!modelId) {
        throw new Error(`Unsupported Anthropic model: ${model}. Supported models: ${Object.keys(BEDROCK_MODEL_IDS).join(', ')}`);
    }
    return modelId;
}
/**
 * Generates text using Anthropic Claude models via AWS Bedrock
 *
 * @param request - Generation request parameters
 * @returns Generation response with content and token counts
 * @throws Error on API failures or timeout
 */
async function generateText(request) {
    const client = getBedrockClient();
    const model = request.model || 'claude-sonnet-4.5';
    const maxTokens = request.maxTokens || 8000;
    const temperature = request.temperature ?? 0.7;
    try {
        const modelId = getBedrockModelId(model);
        // Count input tokens (approximate using tiktoken)
        const inputTokens = (0, tokenCounter_1.countTokens)(request.prompt, 'gpt-4');
        // Prepare Bedrock request payload
        const payload = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            temperature,
            messages: [
                {
                    role: 'user',
                    content: request.prompt,
                },
            ],
        };
        if (request.systemPrompt) {
            payload.system = request.systemPrompt;
        }
        // Call Bedrock API
        const command = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload),
        });
        const response = await client.send(command);
        // Parse response
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        // Extract content from Anthropic response format
        const content = responseBody.content?.[0]?.text || '';
        const outputTokens = responseBody.usage?.output_tokens || (0, tokenCounter_1.countTokens)(content, 'gpt-4');
        const actualInputTokens = responseBody.usage?.input_tokens || inputTokens;
        return {
            content,
            model,
            tokensInput: actualInputTokens,
            tokensOutput: outputTokens,
            provider: 'bedrock',
        };
    }
    catch (error) {
        // Handle throttling
        if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
            throw new Error('Anthropic Bedrock rate limit exceeded. Please try again later.');
        }
        // Handle timeout
        if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
            throw new Error('Anthropic Bedrock request timed out after 30 seconds');
        }
        // Handle authentication/authorization errors
        if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
            throw new Error('AWS credentials are invalid or expired');
        }
        if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
            throw new Error('AWS IAM role does not have permission to invoke Bedrock models');
        }
        // Handle model not found
        if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
            throw new Error(`Bedrock model not found or not enabled in eu-west-2 region`);
        }
        // Handle validation errors
        if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
            throw new Error(`Invalid request to Bedrock: ${error?.message || 'Unknown validation error'}`);
        }
        // Generic error
        throw new Error(`Anthropic Bedrock API error: ${error?.message || 'Unknown error'}`);
    }
}
/**
 * Generates text with streaming support
 * Returns an async generator that yields content chunks
 *
 * @param request - Generation request parameters
 * @returns Async generator yielding text chunks and final response
 */
async function* generateTextStream(request) {
    const client = getBedrockClient();
    const model = request.model || 'claude-sonnet-4.5';
    const maxTokens = request.maxTokens || 8000;
    const temperature = request.temperature ?? 0.7;
    try {
        const modelId = getBedrockModelId(model);
        // Count input tokens (approximate)
        const inputTokens = (0, tokenCounter_1.countTokens)(request.prompt, 'gpt-4');
        // Prepare Bedrock request payload
        const payload = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            temperature,
            messages: [
                {
                    role: 'user',
                    content: request.prompt,
                },
            ],
        };
        if (request.systemPrompt) {
            payload.system = request.systemPrompt;
        }
        // Call Bedrock API with streaming
        const command = new client_bedrock_runtime_1.InvokeModelWithResponseStreamCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload),
        });
        const response = await client.send(command);
        if (!response.body) {
            throw new Error('No response body received from Bedrock');
        }
        let fullContent = '';
        let actualInputTokens = inputTokens;
        let actualOutputTokens = 0;
        // Stream chunks to caller
        for await (const event of response.body) {
            if (event.chunk) {
                const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
                // Handle different event types
                if (chunkData.type === 'content_block_delta') {
                    const delta = chunkData.delta?.text || '';
                    if (delta) {
                        fullContent += delta;
                        yield delta;
                    }
                }
                else if (chunkData.type === 'message_start') {
                    // Extract token usage from message start
                    if (chunkData.message?.usage?.input_tokens) {
                        actualInputTokens = chunkData.message.usage.input_tokens;
                    }
                }
                else if (chunkData.type === 'message_delta') {
                    // Extract output token count from message delta
                    if (chunkData.usage?.output_tokens) {
                        actualOutputTokens = chunkData.usage.output_tokens;
                    }
                }
            }
        }
        // Fallback token counting if not provided
        if (actualOutputTokens === 0) {
            actualOutputTokens = (0, tokenCounter_1.countTokens)(fullContent, 'gpt-4');
        }
        // Return final response
        return {
            content: fullContent,
            model,
            tokensInput: actualInputTokens,
            tokensOutput: actualOutputTokens,
            provider: 'bedrock',
        };
    }
    catch (error) {
        // Handle throttling
        if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
            throw new Error('Anthropic Bedrock rate limit exceeded. Please try again later.');
        }
        // Handle timeout
        if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
            throw new Error('Anthropic Bedrock streaming request timed out after 30 seconds');
        }
        // Handle authentication/authorization errors
        if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
            throw new Error('AWS credentials are invalid or expired');
        }
        if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
            throw new Error('AWS IAM role does not have permission to invoke Bedrock models');
        }
        // Handle model not found
        if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
            throw new Error(`Bedrock model not found or not enabled in eu-west-2 region`);
        }
        // Handle validation errors
        if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
            throw new Error(`Invalid streaming request to Bedrock: ${error?.message || 'Unknown validation error'}`);
        }
        // Generic error
        throw new Error(`Anthropic Bedrock streaming error: ${error?.message || 'Unknown error'}`);
    }
}
//# sourceMappingURL=anthropic.js.map