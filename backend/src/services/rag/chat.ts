/**
 * RAG Chat Service
 * Handles chat completion with RAG context retrieval
 * 
 * Features:
 * - Query embedding generation
 * - Hybrid search with reranking
 * - Context-aware prompt building
 * - Streaming LLM responses
 * - Citation tracking
 */

import { searchDocuments, SearchResult } from './search';
import { generateText, generateTextStream } from '../ai/generation';
import { AIGenerationRequest } from '../ai/types';
import { countTokens } from '../../utils/tokenCounter';

/**
 * Chat request interface
 */
export interface ChatRequest {
  tenantId: string;
  userId: string;
  query: string;
  maxContextChunks?: number;
  model?: string;
  temperature?: number;
  stream?: boolean;
}

/**
 * Chat response interface
 */
export interface ChatResponse {
  answer: string;
  citations: SearchResult[];
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

/**
 * Builds a RAG prompt with context from search results
 * 
 * @param query - User's question
 * @param searchResults - Retrieved context chunks
 * @returns Formatted prompt with context
 */
function buildRAGPrompt(query: string, searchResults: SearchResult[]): string {
  const contextChunks = searchResults
    .map((result, index) => {
      const docTitle = result.metadata?.title || `Document ${result.documentId}`;
      return `[${index + 1}] ${docTitle} (Chunk ${result.chunkIndex}):\n${result.chunkContent}`;
    })
    .join('\n\n');

  return `You are a helpful AI assistant. Answer the user's question based on the provided context. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${contextChunks}

User Question: ${query}

Instructions:
- Answer the question using the context provided above
- Cite sources using [1], [2], etc. when referencing specific information
- If the context doesn't contain relevant information, say "I don't have enough information in the provided context to answer this question."
- Be concise and accurate
- Do not make up information not present in the context

Answer:`;
}

/**
 * Performs RAG chat completion with context retrieval
 * 
 * @param request - Chat request parameters
 * @returns Chat response with answer and citations
 */
export async function chatWithRAG(request: ChatRequest): Promise<ChatResponse> {
  const {
    tenantId,
    query,
    maxContextChunks = 10,
    model,
    temperature = 0.7,
  } = request;

  // Step 1: Retrieve relevant context using hybrid search + reranking
  const searchResults = await searchDocuments({
    tenantId,
    query,
    limit: 50,
    useReranking: true,
    rerankTopN: maxContextChunks,
  });

  // Step 2: Take top N chunks for context
  const contextChunks = searchResults.slice(0, maxContextChunks);

  // Step 3: Build prompt with context
  const prompt = buildRAGPrompt(query, contextChunks);

  // Step 4: Generate response (non-streaming)
  const aiRequest: AIGenerationRequest = {
    prompt,
    model: model as any,
    temperature,
    maxTokens: 2000,
    stream: false,
  };

  // Use unified generation service with AI router
  const aiResponse = await generateText(aiRequest);

  return {
    answer: aiResponse.content,
    citations: contextChunks,
    model: aiResponse.model,
    tokensInput: aiResponse.tokensInput,
    tokensOutput: aiResponse.tokensOutput,
  };
}

/**
 * Performs RAG chat completion with streaming response
 * 
 * @param request - Chat request parameters
 * @returns Async generator yielding text chunks and final response
 */
export async function* chatWithRAGStream(
  request: ChatRequest
): AsyncGenerator<string, ChatResponse, undefined> {
  const {
    tenantId,
    query,
    maxContextChunks = 10,
    model,
    temperature = 0.7,
  } = request;

  // Step 1: Retrieve relevant context using hybrid search + reranking
  const searchResults = await searchDocuments({
    tenantId,
    query,
    limit: 50,
    useReranking: true,
    rerankTopN: maxContextChunks,
  });

  // Step 2: Take top N chunks for context
  const contextChunks = searchResults.slice(0, maxContextChunks);

  // Step 3: Build prompt with context
  const prompt = buildRAGPrompt(query, contextChunks);

  // Step 4: Generate streaming response
  const aiRequest: AIGenerationRequest = {
    prompt,
    model: model as any,
    temperature,
    maxTokens: 2000,
    stream: true,
  };

  // Stream the response and collect final metadata
  const streamGenerator = generateTextStream(aiRequest);
  let fullAnswer = '';
  let tokensInput = 0;
  let tokensOutput = 0;
  let modelUsed = model || 'deepseek-v3';

  try {
    // Yield each chunk as it arrives
    for await (const chunk of streamGenerator) {
      fullAnswer += chunk;
      yield chunk;
    }
  } catch (error) {
    throw error;
  }

  // The generator's return value contains the final metadata
  // We need to manually track this since the generator completes after the loop
  // Count tokens using tiktoken for accuracy
  tokensInput = countTokens(prompt, 'gpt-4');
  tokensOutput = countTokens(fullAnswer, 'gpt-4');

  return {
    answer: fullAnswer,
    citations: contextChunks,
    model: modelUsed,
    tokensInput,
    tokensOutput,
  };
}
