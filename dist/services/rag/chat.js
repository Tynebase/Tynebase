"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithRAG = chatWithRAG;
exports.chatWithRAGStream = chatWithRAGStream;
const search_1 = require("./search");
const generation_1 = require("../ai/generation");
const tokenCounter_1 = require("../../utils/tokenCounter");
/**
 * Builds a RAG prompt with context from search results and conversation history
 *
 * @param query - User's question
 * @param searchResults - Retrieved context chunks
 * @param history - Previous conversation messages
 * @returns Formatted prompt with context and history
 */
function buildRAGPrompt(query, searchResults, history) {
    const contextChunks = searchResults
        .map((result, index) => {
        const docTitle = result.metadata?.title || `Document ${result.documentId}`;
        return `[${index + 1}] ${docTitle} (Chunk ${result.chunkIndex}):\n${result.chunkContent}`;
    })
        .join('\n\n');
    let conversationHistory = '';
    if (history && history.length > 0) {
        conversationHistory = '\n\nConversation History:\n' + history
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n') + '\n';
    }
    return `You are a helpful AI assistant. Answer the user's question based on the provided context and conversation history. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${contextChunks}${conversationHistory}

User Question: ${query}

Instructions:
- Answer the question using the context provided above
- Consider the conversation history for context continuity
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
async function chatWithRAG(request) {
    const { tenantId, query, history, maxContextChunks = 10, model, temperature = 0.7, } = request;
    // Step 1: Retrieve relevant context using hybrid search + reranking
    const searchResults = await (0, search_1.searchDocuments)({
        tenantId,
        query,
        limit: 50,
        useReranking: true,
        rerankTopN: maxContextChunks,
    });
    // Step 2: Take top N chunks for context
    const contextChunks = searchResults.slice(0, maxContextChunks);
    // Step 3: Build prompt with context and history
    const prompt = buildRAGPrompt(query, contextChunks, history);
    // Step 4: Generate response (non-streaming)
    const aiRequest = {
        prompt,
        model: model,
        temperature,
        maxTokens: 2000,
        stream: false,
    };
    // Use unified generation service with AI router
    const aiResponse = await (0, generation_1.generateText)(aiRequest);
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
async function* chatWithRAGStream(request) {
    const { tenantId, query, history, maxContextChunks = 10, model, temperature = 0.7, } = request;
    // Step 1: Retrieve relevant context using hybrid search + reranking
    const searchResults = await (0, search_1.searchDocuments)({
        tenantId,
        query,
        limit: 50,
        useReranking: true,
        rerankTopN: maxContextChunks,
    });
    // Step 2: Take top N chunks for context
    const contextChunks = searchResults.slice(0, maxContextChunks);
    // Step 3: Build prompt with context and history
    const prompt = buildRAGPrompt(query, contextChunks, history);
    // Step 4: Generate streaming response
    console.log(`[RAG Chat] Starting LLM stream with model: ${model || 'default'}`);
    const aiRequest = {
        prompt,
        model: model,
        temperature,
        maxTokens: 2000,
        stream: true,
    };
    // Stream the response and collect final metadata
    const streamGenerator = (0, generation_1.generateTextStream)(aiRequest);
    let fullAnswer = '';
    let tokensInput = 0;
    let tokensOutput = 0;
    let modelUsed = model || 'deepseek-v3';
    try {
        console.log(`[RAG Chat] Entering stream loop`);
        // Yield each chunk as it arrives
        for await (const chunk of streamGenerator) {
            fullAnswer += chunk;
            yield chunk;
        }
        console.log(`[RAG Chat] Stream completed, answer length: ${fullAnswer.length}`);
    }
    catch (error) {
        console.error(`[RAG Chat] Stream error:`, error);
        throw error;
    }
    // The generator's return value contains the final metadata
    // We need to manually track this since the generator completes after the loop
    // Count tokens using tiktoken for accuracy
    tokensInput = (0, tokenCounter_1.countTokens)(prompt, 'gpt-4');
    tokensOutput = (0, tokenCounter_1.countTokens)(fullAnswer, 'gpt-4');
    return {
        answer: fullAnswer,
        citations: contextChunks,
        model: modelUsed,
        tokensInput,
        tokensOutput,
    };
}
//# sourceMappingURL=chat.js.map