/**
 * AI Provider Types and Interfaces
 * Defines the contract for AI provider implementations
 */

export type AIProvider = 'bedrock' | 'vertex';

export type AIModel = 
  | 'deepseek-v3'
  | 'claude-sonnet-4.5'
  | 'gemini-3-flash';

export type AICapability = 'text-generation' | 'video-transcription' | 'audio-transcription';

export interface AIProviderConfig {
  provider: AIProvider;
  model: AIModel;
  capabilities: AICapability[];
  endpoint: string;
  region: string;
}

export interface AIGenerationRequest {
  prompt: string;
  model?: AIModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIGenerationResponse {
  content: string;
  model: AIModel;
  tokensInput: number;
  tokensOutput: number;
  provider: AIProvider;
}

export interface TenantAISettings {
  ai_provider?: AIProvider;
  preferred_model?: AIModel;
  [key: string]: any;
}
