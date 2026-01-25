/**
 * AWS Bedrock Cohere Embedding Service
 * Handles text embeddings using Cohere Embed v4.0 through AWS Bedrock (eu-west-2)
 * 
 * Features:
 * - Cohere Embed v4.0 with 1536 dimensions (default)
 * - Cohere Rerank v3.5 for result reranking
 * - Batch embedding support
 * - Automatic retry on throttling
 * - UK data residency compliance (eu-west-2)
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

/**
 * Bedrock client configured for EU region
 */
let bedrockClient: BedrockRuntimeClient | null = null;

/**
 * Cohere model IDs in Bedrock
 */
const COHERE_EMBED_MODEL_ID = 'cohere.embed-english-v3';
const COHERE_RERANK_MODEL_ID = 'cohere.rerank-english-v3';

/**
 * Embedding dimensions for Cohere Embed v4.0
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Initializes the Bedrock client with EU region
 * Uses AWS Bedrock API key from environment
 * @throws Error if AWS credentials are not configured
 */
function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const apiKey = process.env.AWS_BEDROCK_API_KEY;
    const region = process.env.AWS_REGION || 'eu-west-2';
    
    if (!apiKey) {
      throw new Error('AWS_BEDROCK_API_KEY environment variable must be set');
    }

    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: apiKey,
        secretAccessKey: apiKey,
      },
      maxAttempts: 3,
    });
  }
  return bedrockClient;
}

/**
 * Generates embeddings for text using Cohere Embed v4.0 via AWS Bedrock
 * Used for RAG (Retrieval-Augmented Generation) pipeline
 * 
 * @param text - Text to embed
 * @param inputType - Type of input: 'search_document' for indexing, 'search_query' for querying
 * @returns Array of embedding values (1536 dimensions)
 */
export async function generateEmbedding(
  text: string,
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[]> {
  const client = getBedrockClient();

  try {
    const payload = {
      texts: [text],
      input_type: inputType,
      embedding_types: ['float'],
      truncate: 'END',
    };

    const command = new InvokeModelCommand({
      modelId: COHERE_EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embeddings || !responseBody.embeddings.float || !responseBody.embeddings.float[0]) {
      throw new Error('Invalid response format from Cohere Embed API');
    }

    return responseBody.embeddings.float[0];
  } catch (error: any) {
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('Cohere Bedrock rate limit exceeded. Please try again later.');
    }

    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('Cohere Bedrock request timed out');
    }

    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API credentials are invalid or expired');
    }

    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API credentials do not have permission to invoke Cohere Embed model');
    }

    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('Cohere Embed model not found or not enabled in eu-west-2 region');
    }

    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid request to Cohere Embed: ${error?.message || 'Unknown validation error'}`);
    }

    throw new Error(
      `Cohere Embed API error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Batch generates embeddings for multiple texts
 * More efficient than calling generateEmbedding multiple times
 * 
 * @param texts - Array of texts to embed (max 96 for Cohere)
 * @param inputType - Type of input: 'search_document' for indexing, 'search_query' for querying
 * @returns Array of embedding arrays
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[][]> {
  const client = getBedrockClient();

  if (texts.length > 96) {
    throw new Error('Maximum 96 texts allowed per batch for Cohere Embed');
  }

  try {
    const payload = {
      texts,
      input_type: inputType,
      embedding_types: ['float'],
      truncate: 'END',
    };

    const command = new InvokeModelCommand({
      modelId: COHERE_EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embeddings || !responseBody.embeddings.float) {
      throw new Error('Invalid response format from Cohere Embed API');
    }

    return responseBody.embeddings.float;
  } catch (error: any) {
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('Cohere Bedrock rate limit exceeded for batch embeddings. Please try again later.');
    }

    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('Cohere Bedrock batch request timed out');
    }

    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API credentials are invalid or expired');
    }

    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API credentials do not have permission to invoke Cohere Embed model');
    }

    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('Cohere Embed model not found or not enabled in eu-west-2 region');
    }

    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid batch request to Cohere Embed: ${error?.message || 'Unknown validation error'}`);
    }

    throw new Error(
      `Cohere Embed batch API error: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Document interface for reranking
 */
export interface RerankDocument {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Reranked result interface
 */
export interface RerankResult {
  index: number;
  relevanceScore: number;
  document: RerankDocument;
}

/**
 * Reranks search results using Cohere Rerank v3.5 via AWS Bedrock
 * Improves search quality by reordering results based on relevance to query
 * 
 * @param query - Search query
 * @param documents - Array of documents to rerank
 * @param topN - Number of top results to return (default: all)
 * @returns Array of reranked results with relevance scores
 */
export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  topN?: number
): Promise<RerankResult[]> {
  const client = getBedrockClient();

  try {
    const payload = {
      query,
      documents: documents.map(doc => doc.text),
      top_n: topN || documents.length,
      return_documents: false,
    };

    const command = new InvokeModelCommand({
      modelId: COHERE_RERANK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.results || !Array.isArray(responseBody.results)) {
      throw new Error('Invalid response format from Cohere Rerank API');
    }

    return responseBody.results.map((result: any) => ({
      index: result.index,
      relevanceScore: result.relevance_score,
      document: documents[result.index],
    }));
  } catch (error: any) {
    if (error?.name === 'ThrottlingException' || error?.$metadata?.httpStatusCode === 429) {
      throw new Error('Cohere Bedrock rate limit exceeded for reranking. Please try again later.');
    }

    if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
      throw new Error('Cohere Bedrock rerank request timed out');
    }

    if (error?.name === 'UnauthorizedException' || error?.$metadata?.httpStatusCode === 401) {
      throw new Error('AWS Bedrock API credentials are invalid or expired');
    }

    if (error?.name === 'AccessDeniedException' || error?.$metadata?.httpStatusCode === 403) {
      throw new Error('AWS Bedrock API credentials do not have permission to invoke Cohere Rerank model');
    }

    if (error?.name === 'ResourceNotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      throw new Error('Cohere Rerank model not found or not enabled in eu-west-2 region');
    }

    if (error?.name === 'ValidationException' || error?.$metadata?.httpStatusCode === 400) {
      throw new Error(`Invalid request to Cohere Rerank: ${error?.message || 'Unknown validation error'}`);
    }

    throw new Error(
      `Cohere Rerank API error: ${error?.message || 'Unknown error'}`
    );
  }
}
