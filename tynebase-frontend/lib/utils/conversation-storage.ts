/**
 * Conversation Storage Utilities
 * 
 * Manages persistent storage of chat conversations in localStorage.
 * Supports multiple conversations with metadata and message history.
 */

import { ChatSource } from '@/lib/api/ai';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'tynebase_conversations';
const ACTIVE_CONVERSATION_KEY = 'tynebase_active_conversation';
const MAX_CONVERSATIONS = 50;

/**
 * Get all stored conversations
 */
export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const conversations = JSON.parse(stored);
    
    // Parse dates
    return conversations.map((conv: Conversation) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
}

/**
 * Get a specific conversation by ID
 */
export function getConversation(id: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find(conv => conv.id === id) || null;
}

/**
 * Get the active conversation ID
 */
export function getActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

/**
 * Set the active conversation ID
 */
export function setActiveConversationId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
}

/**
 * Create a new conversation
 */
export function createConversation(title?: string): Conversation {
  const conversation: Conversation = {
    id: generateId(),
    title: title || 'New Conversation',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const conversations = getConversations();
  conversations.unshift(conversation);
  
  // Limit total conversations
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations.splice(MAX_CONVERSATIONS);
  }
  
  saveConversations(conversations);
  setActiveConversationId(conversation.id);
  
  return conversation;
}

/**
 * Update a conversation
 */
export function updateConversation(id: string, updates: Partial<Conversation>): void {
  const conversations = getConversations();
  const index = conversations.findIndex(conv => conv.id === id);
  
  if (index === -1) return;
  
  conversations[index] = {
    ...conversations[index],
    ...updates,
    updatedAt: new Date(),
  };
  
  saveConversations(conversations);
}

/**
 * Add a message to a conversation
 */
export function addMessage(conversationId: string, message: StoredMessage): void {
  const conversations = getConversations();
  const conversation = conversations.find(conv => conv.id === conversationId);
  
  if (!conversation) return;
  
  conversation.messages.push(message);
  conversation.updatedAt = new Date();
  
  // Auto-generate title from first user message if still default
  if (conversation.title === 'New Conversation' && message.role === 'user') {
    conversation.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
  }
  
  saveConversations(conversations);
}

/**
 * Get the last N messages from a conversation for context
 */
export function getRecentMessages(conversationId: string, count: number = 20): StoredMessage[] {
  const conversation = getConversation(conversationId);
  if (!conversation) return [];
  
  return conversation.messages.slice(-count);
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
  const conversations = getConversations();
  const filtered = conversations.filter(conv => conv.id !== id);
  saveConversations(filtered);
  
  // Clear active conversation if it was deleted
  if (getActiveConversationId() === id) {
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

/**
 * Clear all conversations
 */
export function clearAllConversations(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
}

/**
 * Save conversations to localStorage
 */
function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations:', error);
    
    // If storage is full, remove oldest conversations
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      const reduced = conversations.slice(0, Math.floor(conversations.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
    }
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export conversations as JSON
 */
export function exportConversations(): string {
  const conversations = getConversations();
  return JSON.stringify(conversations, null, 2);
}

/**
 * Import conversations from JSON
 */
export function importConversations(json: string): boolean {
  try {
    const conversations = JSON.parse(json);
    
    // Validate structure
    if (!Array.isArray(conversations)) {
      throw new Error('Invalid format');
    }
    
    saveConversations(conversations);
    return true;
  } catch (error) {
    console.error('Failed to import conversations:', error);
    return false;
  }
}
