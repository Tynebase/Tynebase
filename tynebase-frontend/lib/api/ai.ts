/**
 * AI Operations API Service Layer
 * 
 * Provides functions for interacting with backend AI endpoints including:
 * - Text generation from prompts
 * - Document enhancement and suggestions
 * - RAG chat with document context
 * - Video transcription (upload and YouTube)
 * - URL scraping
 * - Job status tracking
 */

import { apiGet, apiPost, apiUpload } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Job {
  id: string;
  tenant_id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GenerateRequest {
  prompt: string;
  model?: 'deepseek-v3' | 'claude-sonnet-4.5' | 'gemini-3-flash';
  max_tokens?: number;
}

export interface GenerateResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface EnhanceRequest {
  document_id: string;
}

export interface EnhanceSuggestion {
  type: 'grammar' | 'clarity' | 'structure' | 'completeness' | 'style';
  title: string;
  reason: string;
  original?: string;
  suggested?: string;
}

export interface EnhanceResponse {
  success: true;
  data: {
    score: number;
    suggestions: EnhanceSuggestion[];
  };
}

export interface ApplySuggestionRequest {
  document_id: string;
  suggestion_type: string;
  context?: string;
}

export interface ApplySuggestionResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query: string;
  history?: ChatMessage[];
  max_context_chunks?: number;
  model?: string;
  temperature?: number;
  stream?: boolean;
}

export interface ChatSource {
  document_id: string;
  title: string;
  chunk_text: string;
  similarity_score: number;
}

export interface ChatResponse {
  success: true;
  data: {
    answer: string;
    sources: ChatSource[];
    model: string;
    total_tokens: number;
  };
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface VideoUploadResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface YouTubeVideoRequest {
  url: string;
}

export interface YouTubeVideoResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface JobStatusResponse {
  success: true;
  data: {
    job: Job;
  };
}

export interface SearchRequest {
  query: string;
  limit?: number;
  use_reranking?: boolean;
  rerank_top_n?: number;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  similarity_score: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  success: true;
  data: {
    results: SearchResult[];
    total: number;
  };
}

// ============================================================================
// AI GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate content from a text prompt
 * 
 * Creates a background job that generates content using AI.
 * Poll the job status to get the generated content.
 * 
 * @param data - Generation request with prompt and optional model/max_tokens
 * @returns Job details for tracking generation progress
 */
export async function generate(data: GenerateRequest): Promise<GenerateResponse> {
  return apiPost<GenerateResponse>('/api/ai/generate', data);
}

/**
 * Enhance a document with AI suggestions
 * 
 * Analyzes document content and provides improvement suggestions
 * for grammar, clarity, structure, completeness, and style.
 * 
 * @param data - Enhancement request with document_id
 * @returns Enhancement score and list of suggestions
 */
export async function enhance(data: EnhanceRequest): Promise<EnhanceResponse> {
  return apiPost<EnhanceResponse>('/api/ai/enhance', data);
}

/**
 * Apply a specific enhancement suggestion
 * 
 * Creates a background job to generate improved content based on
 * a specific suggestion type.
 * 
 * @param data - Apply suggestion request
 * @returns Job details for tracking enhancement progress
 */
export async function applySuggestion(
  data: ApplySuggestionRequest
): Promise<ApplySuggestionResponse> {
  return apiPost<ApplySuggestionResponse>('/api/ai/enhance/apply', data);
}

// ============================================================================
// RAG CHAT FUNCTIONS
// ============================================================================

/**
 * Chat with RAG (Retrieval-Augmented Generation)
 * 
 * Searches indexed documents for relevant context and generates
 * an AI response based on that context.
 * 
 * @param data - Chat request with query and optional parameters
 * @returns AI-generated answer with source citations
 */
export async function chat(data: ChatRequest): Promise<ChatResponse> {
  return apiPost<ChatResponse>('/api/ai/chat', data);
}

/**
 * Chat with RAG using streaming response
 * 
 * Streams the AI response token by token for real-time display.
 * 
 * @param data - Chat request with query and optional parameters
 * @param onChunk - Callback for each streamed text chunk
 * @param onSources - Callback when sources are received
 * @returns Promise that resolves when streaming completes
 */
export async function chatStream(
  data: ChatRequest,
  onChunk: (text: string) => void,
  onSources?: (sources: ChatSource[]) => void
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenant = typeof window !== 'undefined' ? localStorage.getItem('tenant_subdomain') : null;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-tenant-subdomain': tenant || '',
    },
    body: JSON.stringify({ ...data, stream: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Chat request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'chunk' && parsed.content) {
            onChunk(parsed.content);
          } else if (parsed.type === 'citations' && parsed.citations && onSources) {
            // Map backend citation format to frontend ChatSource format
            const sources: ChatSource[] = parsed.citations.map((citation: any) => ({
              document_id: citation.documentId,
              title: citation.metadata?.title || 'Untitled Document',
              chunk_text: citation.content,
              similarity_score: citation.rerankScore ?? citation.similarityScore ?? 0,
            }));
            onSources(sources);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'Stream error');
          }
        } catch (e) {
          console.warn('Failed to parse SSE data:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Search indexed documents
 * 
 * Performs semantic search across indexed document chunks
 * using vector similarity.
 * 
 * @param data - Search request with query and optional parameters
 * @returns Ranked search results with similarity scores
 */
export async function search(data: SearchRequest): Promise<SearchResponse> {
  return apiPost<SearchResponse>('/api/rag/search', data);
}

// ============================================================================
// VIDEO PROCESSING FUNCTIONS
// ============================================================================

/**
 * Upload and transcribe a video file
 * 
 * Uploads a video file and creates a background job for transcription.
 * Supported formats: MP4, MOV, AVI (max 500MB)
 * 
 * @param file - Video file to upload
 * @returns Job details for tracking transcription progress
 */
export async function uploadVideo(file: File): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiUpload<VideoUploadResponse>('/api/ai/video/upload', formData);
}

/**
 * Transcribe a YouTube video
 * 
 * Creates a background job to download and transcribe a YouTube video.
 * 
 * @param data - YouTube video request with URL
 * @returns Job details for tracking transcription progress
 */
export async function transcribeYouTube(
  data: YouTubeVideoRequest
): Promise<YouTubeVideoResponse> {
  return apiPost<YouTubeVideoResponse>('/api/ai/video/youtube', data);
}

// ============================================================================
// WEB SCRAPING FUNCTIONS
// ============================================================================

/**
 * Scrape content from a URL
 * 
 * Creates a background job to extract and convert web content to markdown.
 * 
 * @param data - Scrape request with URL
 * @returns Job details for tracking scraping progress
 */
export async function scrapeUrl(data: ScrapeRequest): Promise<ScrapeResponse> {
  return apiPost<ScrapeResponse>('/api/ai/scrape', data);
}

// ============================================================================
// JOB STATUS FUNCTIONS
// ============================================================================

/**
 * Get the status of a background job
 * 
 * Poll this endpoint to track progress of AI operations like
 * generation, transcription, or scraping.
 * 
 * @param jobId - Job UUID
 * @returns Current job status and result (if completed)
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiGet<JobStatusResponse>(`/api/jobs/${jobId}`);
}

/**
 * Poll a job until completion
 * 
 * Utility function that polls job status at regular intervals
 * until the job completes or fails.
 * 
 * @param jobId - Job UUID
 * @param onProgress - Optional callback for progress updates
 * @param pollInterval - Polling interval in milliseconds (default: 2000)
 * @param maxAttempts - Maximum polling attempts (default: 150, ~5 minutes)
 * @returns Final job status
 */
export async function pollJobUntilComplete(
  jobId: string,
  onProgress?: (job: Job) => void,
  pollInterval: number = 2000,
  maxAttempts: number = 150
): Promise<Job> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await getJobStatus(jobId);
    const job = response.data.job;
    
    if (onProgress) {
      onProgress(job);
    }
    
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }
  
  throw new Error('Job polling timeout - maximum attempts reached');
}

// ============================================================================
// SOURCE MANAGEMENT FUNCTIONS
// ============================================================================

export interface ReindexResponse {
  success: true;
  data: {
    message: string;
    job_id: string;
    status: string;
    document_id: string;
    document_title: string;
  };
}

/**
 * Trigger manual re-indexing of a document
 * 
 * Creates a background job to re-index a document's embeddings.
 * Requires admin role. Skips if a re-index job is already pending.
 * 
 * @param documentId - Document UUID to re-index
 * @returns Job details for tracking re-index progress
 */
export async function reindexDocument(documentId: string): Promise<ReindexResponse> {
  return apiPost<ReindexResponse>(`/api/sources/${documentId}/reindex`, {});
}
