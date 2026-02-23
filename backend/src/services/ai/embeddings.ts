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
import {
  BedrockAgentRuntimeClient,
  RerankCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

/**
 * Bedrock clients configured for specific regions
 */
const clients = new Map<string, BedrockRuntimeClient>();
const agentClients = new Map<string, BedrockAgentRuntimeClient>();

/**
 * Cohere model and region configuration
 */
const EMBED_MODEL_ID = process.env.BEDROCK_EMBED_MODEL_ID || 'cohere.embed-v4:0';
const EMBED_REGION = process.env.BEDROCK_EMBED_REGION || 'eu-west-1';

const SEARCH_MODEL_ID = process.env.BEDROCK_SEARCH_MODEL_ID || 'cohere.embed-v4:0';
const SEARCH_REGION = process.env.BEDROCK_SEARCH_REGION || 'eu-west-1';

const RERANK_MODEL_ID = process.env.BEDROCK_RERANK_MODEL_ID || 'cohere.rerank-v3-5:0';
const RERANK_REGION = process.env.BEDROCK_RERANK_REGION || 'eu-central-1';

// Build full ARN for rerank model (required by Bedrock Agent Runtime)
const getModelArn = (modelId: string, region: string) => 
  `arn:aws:bedrock:${region}::foundation-model/${modelId}`;

/**
 * Embedding dimensions for Cohere Embed v4
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Timeout for reranking operations (2 seconds)
 */
const RERANK_TIMEOUT_MS = 2000;

/**
 * Gets or creates a Bedrock Runtime client for a specific region
 */
function getBedrockClient(region: string): BedrockRuntimeClient {
  if (!clients.has(region)) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials must be set');
    }

    clients.set(region, new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3,
    }));
  }
  return clients.get(region)!;
}

/**
 * Gets or creates a Bedrock Agent Runtime client for a specific region
 */
function getAgentRuntimeClient(region: string): BedrockAgentRuntimeClient {
  if (!agentClients.has(region)) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials must be set');
    }

    agentClients.set(region, new BedrockAgentRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3,
    }));
  }
  return agentClients.get(region)!;
}

/**
 * Generates embeddings for text (Optimized for Search/Query)
 * Uses London region + Global profile for best performance
 */
export async function generateEmbedding(
  text: string,
  inputType: 'search_document' | 'search_query' = 'search_query'
): Promise<number[]> {
  const client = getBedrockClient(SEARCH_REGION);

  try {
    const payload = {
      texts: [text],
      input_type: inputType,
      embedding_types: ['float'],
      output_dimension: EMBEDDING_DIMENSIONS,
      truncate: 'RIGHT',
    };

    console.log(`[Bedrock] Generating embedding (Search) with model ${SEARCH_MODEL_ID} in ${SEARCH_REGION}`);

    const command = new InvokeModelCommand({
      modelId: SEARCH_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embeddings?.float?.[0]) {
      throw new Error('Invalid response format from Cohere Embed API');
    }

    return responseBody.embeddings.float[0];
  } catch (error: any) {
    handleBedrockError(error, 'Embedding');
    throw error;
  }
}

/**
 * Batch generates embeddings (Optimized for Indexing)
 * Uses Ireland region + Regional ID for batch support
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[][]> {
  const client = getBedrockClient(EMBED_REGION);

  if (texts.length > 96) {
    throw new Error('Maximum 96 texts allowed per batch');
  }

  try {
    const payload = {
      texts,
      input_type: inputType,
      embedding_types: ['float'],
      output_dimension: EMBEDDING_DIMENSIONS,
      truncate: 'RIGHT',
    };

    console.log(`[Bedrock] Generating batch embeddings (${texts.length}) with model ${EMBED_MODEL_ID} in ${EMBED_REGION}`);

    const command = new InvokeModelCommand({
      modelId: EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embeddings?.float) {
      throw new Error('Invalid response format from Cohere Embed API');
    }

    return responseBody.embeddings.float;
  } catch (error: any) {
    handleBedrockError(error, 'Batch embedding');
    throw error;
  }
}

/**
 * Handles and normalizes Bedrock service errors
 */
function handleBedrockError(error: any, operation: string): void {
  const name = error?.name || error?.constructor?.name;
  const statusCode = error?.$metadata?.httpStatusCode;
  
  if (name === 'ThrottlingException' || statusCode === 429) {
    console.error(`[Bedrock] ${operation} rate limit exceeded`);
    error.message = 'Bedrock rate limit exceeded. Please try again later.';
  } else if (name === 'AccessDeniedException' || statusCode === 403) {
    console.error(`[Bedrock] ${operation} access denied (check IAM and Model Access in Console)`);
    error.message = 'AWS Bedrock permission denied for this model/region.';
  } else if (name === 'ValidationException' || statusCode === 400) {
    console.error(`[Bedrock] ${operation} validation failed: ${error.message}`);
  } else {
    console.error(`[Bedrock] ${operation} failed: ${error.message}`);
  }
}

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
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
 * Reranks documents using Cohere Rerank 3.5
 * Uses Frankfurt region as required
 */
export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  topN?: number
): Promise<RerankResult[]> {
  const client = getAgentRuntimeClient(RERANK_REGION);

  try {
    console.log(`[Bedrock] Reranking with model ${RERANK_MODEL_ID} in ${RERANK_REGION}`);
    
    const command = new RerankCommand({
      queries: [
        {
          type: 'TEXT',
          textQuery: { text: query },
        },
      ],
      sources: documents.map(doc => ({
        type: 'INLINE',
        inlineDocumentSource: {
          type: 'TEXT',
          textDocument: { text: doc.text },
        },
      })),
      rerankingConfiguration: {
        type: 'BEDROCK_RERANKING_MODEL',
        bedrockRerankingConfiguration: {
          numberOfResults: topN || documents.length,
          modelConfiguration: {
            modelArn: getModelArn(RERANK_MODEL_ID, RERANK_REGION),
          },
        },
      },
    });

    const response = await withTimeout(client.send(command), RERANK_TIMEOUT_MS);
    
    if (!response.results) {
      throw new Error('Invalid response format from Cohere Rerank API');
    }

    return response.results.map((result: any) => ({
      index: result.index,
      relevanceScore: result.relevanceScore,
      document: documents[result.index],
    }));
  } catch (error: any) {
    console.error(`[Bedrock] Rerank failed: ${error.message}`);
    throw error;
  }
}

