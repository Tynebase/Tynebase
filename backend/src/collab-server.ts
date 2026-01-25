import { Server } from '@hocuspocus/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
 * Hocuspocus WebSocket server for real-time collaborative editing
 * Runs on port 8081, separate from main API server
 */
const server = new Server({
  port: PORT,
  name: 'tynebase-collab',

  async onAuthenticate(data: any) {
    const { token, documentName } = data;
    
    if (!token) {
      throw new Error('Authentication token required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, tenant_id')
      .eq('id', documentName)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || userRecord.tenant_id !== document.tenant_id) {
      throw new Error('Unauthorized access to document');
    }

    console.log(`[Collab] User ${user.id} authenticated for document ${documentName}`);
    
    return {
      user: {
        id: user.id,
        name: user.email || 'Anonymous',
      },
    };
  },

  async onLoadDocument(data: any) {
    const { documentName } = data;

    const { data: document, error } = await supabase
      .from('documents')
      .select('yjs_state')
      .eq('id', documentName)
      .single();

    if (error) {
      console.error(`[Collab] Error loading document ${documentName}:`, error);
      return null;
    }

    if (document?.yjs_state) {
      console.log(`[Collab] Loaded document ${documentName} from database`);
      return Buffer.from(document.yjs_state);
    }

    console.log(`[Collab] No existing state for document ${documentName}`);
    return null;
  },

  async onStoreDocument(data: any) {
    const { documentName, state } = data;

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          yjs_state: state,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentName);

      if (error) {
        console.error(`[Collab] Error storing document ${documentName}:`, error);
        return;
      }

      console.log(`[Collab] Stored document ${documentName} to database`);
    } catch (err) {
      console.error(`[Collab] Exception storing document ${documentName}:`, err);
    }
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
