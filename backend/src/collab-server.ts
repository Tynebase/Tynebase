import { Server } from '@hocuspocus/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as Y from 'yjs';

dotenv.config();

const PORT = parseInt(process.env.COLLAB_PORT || '8081', 10);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Debounce storage for document saves
 * Maps documentName → timeout handle
 */
const saveTimeouts = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_DELAY = 2000; // 2 seconds

/**
 * Convert Y.js binary state to Markdown content
 * @param state - Binary Y.js state buffer
 * @returns Markdown string or null if conversion fails
 */
function convertYjsToMarkdown(state: Buffer): string | null {
  try {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(state));
    
    // Get the prosemirror XML fragment from Y.js
    const xmlFragment = ydoc.getXmlFragment('default');
    
    // Convert XML fragment to plain text (simplified approach)
    // In a full implementation, you'd use prosemirror schema to properly convert
    let markdown = '';
    
    // Iterate through XML nodes and extract text content
    xmlFragment.forEach((item) => {
      if (item instanceof Y.XmlText) {
        markdown += item.toString();
      } else if (item instanceof Y.XmlElement) {
        // Recursively extract text from elements
        const extractText = (element: Y.XmlElement): string => {
          let text = '';
          element.forEach((child) => {
            if (child instanceof Y.XmlText) {
              text += child.toString();
            } else if (child instanceof Y.XmlElement) {
              text += extractText(child);
            }
          });
          return text;
        };
        markdown += extractText(item) + '\n';
      }
    });
    
    return markdown.trim() || null;
  } catch (error: any) {
    console.error('[Collab] Error converting Y.js to Markdown:', error.message);
    return null;
  }
}

/**
 * Calculate content similarity to determine if RAG re-indexing is needed
 * @param oldContent - Previous content
 * @param newContent - New content
 * @returns true if content changed significantly (>10% difference)
 */
function hasSignificantContentChange(oldContent: string | null, newContent: string | null): boolean {
  if (!oldContent && newContent) return true;
  if (!oldContent || !newContent) return false;
  
  const oldLength = oldContent.length;
  const newLength = newContent.length;
  
  // Consider significant if length changed by more than 10% or more than 100 characters
  const lengthDiff = Math.abs(newLength - oldLength);
  const percentChange = oldLength > 0 ? lengthDiff / oldLength : 1;
  
  return percentChange > 0.1 || lengthDiff > 100;
}

/**
 * Hocuspocus WebSocket server for real-time collaborative editing
 * Runs on port 8081, separate from main API server
 */
const server = new Server({
  port: PORT,
  name: 'tynebase-collab',

  async onAuthenticate(data: any) {
    const { token } = data;
    const documentName = data.documentName || data.document;
    
    if (!token) {
      console.error('[Collab] Authentication failed: No token provided');
      throw new Error('Authentication token required');
    }

    if (!documentName) {
      console.error('[Collab] Authentication failed: No document name provided');
      throw new Error('Document name required');
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        console.error('[Collab] Authentication failed: Invalid token', authError?.message);
        throw new Error('Invalid authentication token');
      }

      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, tenant_id')
        .eq('id', documentName)
        .single();

      if (docError || !document) {
        console.error(`[Collab] Authentication failed: Document ${documentName} not found`, docError?.message);
        throw new Error('Document not found');
      }

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userError || !userRecord) {
        console.error(`[Collab] Authentication failed: User ${user.id} not found`, userError?.message);
        throw new Error('User not found');
      }

      if (userRecord.tenant_id !== document.tenant_id) {
        console.error(`[Collab] Authentication failed: User ${user.id} tenant ${userRecord.tenant_id} does not match document tenant ${document.tenant_id}`);
        throw new Error('Unauthorized access to document');
      }

      console.log(`[Collab] User ${user.id} authenticated for document ${documentName}`);
      
      return {
        user: {
          id: user.id,
          name: user.email || 'Anonymous',
        },
      };
    } catch (error: any) {
      console.error('[Collab] Authentication error:', error.message);
      throw error;
    }
  },

  async onLoadDocument(data: any) {
    const { documentName } = data;

    try {
      const { data: document, error } = await supabase
        .from('documents')
        .select('yjs_state, tenant_id')
        .eq('id', documentName)
        .single();

      if (error) {
        console.error(`[Collab] Error loading document ${documentName}:`, error);
        return null;
      }

      if (!document) {
        console.error(`[Collab] Document ${documentName} not found`);
        return null;
      }

      if (document.yjs_state) {
        console.log(`[Collab] Loaded document ${documentName} from database (tenant: ${document.tenant_id})`);
        return Buffer.from(document.yjs_state);
      }

      console.log(`[Collab] No existing state for document ${documentName} (tenant: ${document.tenant_id})`);
      return null;
    } catch (err: any) {
      console.error(`[Collab] Exception loading document ${documentName}:`, err.message);
      return null;
    }
  },

  async onStoreDocument(data: any) {
    const { documentName, state } = data;

    // Clear existing timeout for this document
    const existingTimeout = saveTimeouts.get(documentName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new debounced save
    const timeout = setTimeout(async () => {
      try {
        // Get current document content for comparison
        const { data: currentDoc, error: fetchError } = await supabase
          .from('documents')
          .select('content')
          .eq('id', documentName)
          .single();

        if (fetchError) {
          console.error(`[Collab] Error fetching current document ${documentName}:`, fetchError);
        }

        // Convert Y.js state to Markdown
        const markdownContent = convertYjsToMarkdown(state);
        
        // Update document with both binary state and markdown content
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            yjs_state: state,
            content: markdownContent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentName);

        if (updateError) {
          console.error(`[Collab] Error storing document ${documentName}:`, updateError);
          return;
        }

        console.log(`[Collab] Stored document ${documentName} to database (debounced)`);

        // Check if content changed significantly and dispatch RAG index job
        const oldContent = currentDoc?.content || null;
        if (markdownContent && hasSignificantContentChange(oldContent, markdownContent)) {
          console.log(`[Collab] Significant content change detected for ${documentName}, dispatching RAG index job`);
          
          // Get document's tenant_id for job dispatch
          const { data: docData, error: docFetchError } = await supabase
            .from('documents')
            .select('tenant_id')
            .eq('id', documentName)
            .single();

          if (docFetchError || !docData) {
            console.error(`[Collab] Error fetching document tenant for ${documentName}:`, docFetchError?.message);
          } else {
            // Check for existing pending/processing rag_index jobs
            const { data: existingJobs, error: jobCheckError } = await supabase
              .from('job_queue')
              .select('id, status')
              .eq('tenant_id', docData.tenant_id)
              .eq('type', 'rag_index')
              .in('status', ['pending', 'processing'])
              .eq('payload->>document_id', documentName);

            if (jobCheckError) {
              console.error(`[Collab] Error checking existing jobs for ${documentName}:`, jobCheckError.message);
            } else if (existingJobs && existingJobs.length > 0) {
              console.log(`[Collab] Skipping RAG index job for ${documentName} - job already pending/processing`);
            } else {
              // Dispatch new rag_index job
              const { data: job, error: jobInsertError } = await supabase
                .from('job_queue')
                .insert({
                  tenant_id: docData.tenant_id,
                  type: 'rag_index',
                  status: 'pending',
                  payload: { document_id: documentName }
                })
                .select()
                .single();

              if (jobInsertError) {
                console.error(`[Collab] Error dispatching RAG index job for ${documentName}:`, jobInsertError.message);
              } else {
                console.log(`[Collab] RAG index job dispatched: ${job.id} for document ${documentName}`);
              }
            }
          }
        }

        // Clean up timeout reference
        saveTimeouts.delete(documentName);
      } catch (err: any) {
        console.error(`[Collab] Exception storing document ${documentName}:`, err.message);
        saveTimeouts.delete(documentName);
      }
    }, DEBOUNCE_DELAY);

    saveTimeouts.set(documentName, timeout);
  },

  async onConnect(data: any) {
    console.log(`[Collab] Client connected to document ${data.documentName}`);
  },

  async onDisconnect(data: any) {
    console.log(`[Collab] Client disconnected from document ${data.documentName}`);
  },
});

server.listen();

console.log(`[Collab] Hocuspocus server running on port ${PORT}`);
console.log(`[Collab] Environment: ${process.env.NODE_ENV || 'development'}`);

process.on('SIGTERM', () => {
  console.log('[Collab] SIGTERM received, shutting down gracefully');
  server.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Collab] SIGINT received, shutting down gracefully');
  server.destroy();
  process.exit(0);
});
