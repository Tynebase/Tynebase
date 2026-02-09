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
 * Parse inline markdown and return array of text segments with marks
 */
interface TextSegment {
  text: string;
  marks: { bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; link?: { href: string } };
}

function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    // Try to match bold **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      segments.push({ text: boldMatch[1], marks: { bold: true } });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    
    // Try to match italic *text* (but not **)
    const italicMatch = remaining.match(/^\*([^*]+?)\*/);
    if (italicMatch) {
      segments.push({ text: italicMatch[1], marks: { italic: true } });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    // Try to match inline code `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      segments.push({ text: codeMatch[1], marks: { code: true } });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    
    // Try to match strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      segments.push({ text: strikeMatch[1], marks: { strike: true } });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }
    
    // Try to match link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      segments.push({ text: linkMatch[1], marks: { link: { href: linkMatch[2] } } });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    
    // Find next special character or end
    const nextSpecial = remaining.search(/\*|`|~|\[/);
    if (nextSpecial === -1) {
      // No more special chars, add rest as plain text
      if (remaining.length > 0) {
        segments.push({ text: remaining, marks: {} });
      }
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but didn't match a pattern, treat as plain text
      segments.push({ text: remaining[0], marks: {} });
      remaining = remaining.slice(1);
    } else {
      // Add plain text before the special char
      segments.push({ text: remaining.slice(0, nextSpecial), marks: {} });
      remaining = remaining.slice(nextSpecial);
    }
  }
  
  return segments;
}

/**
 * Insert text with inline formatting into a Y.XmlElement
 */
function insertTextWithMarks(parent: Y.XmlElement, text: string): void {
  const segments = parseInlineMarkdown(text);
  
  for (const segment of segments) {
    const textNode = new Y.XmlText();
    textNode.insert(0, segment.text);
    
    // Apply marks
    const hasMarks = segment.marks.bold || segment.marks.italic || segment.marks.code || segment.marks.strike || segment.marks.link;
    if (hasMarks) {
      const attrs: Record<string, any> = {};
      if (segment.marks.bold) attrs.bold = true;
      if (segment.marks.italic) attrs.italic = true;
      if (segment.marks.code) attrs.code = true;
      if (segment.marks.strike) attrs.strike = true;
      if (segment.marks.link) attrs.link = segment.marks.link;
      textNode.format(0, segment.text.length, attrs);
    }
    
    parent.insert(parent.length, [textNode]);
  }
}

/**
 * Initialize a Y.Doc with markdown/text content
 * Converts content to Y.js XML fragment format for TipTap editor
 */
function initializeYdocFromContent(ydoc: Y.Doc, content: string): void {
  const fragment = ydoc.getXmlFragment('default');
  
  const lines = content.split('\n');
  
  // Stack to track nested list context
  // Each entry: { list: Y.XmlElement, lastItem: Y.XmlElement, indent: number, type: 'bullet' | 'ordered' }
  interface ListContext {
    list: Y.XmlElement;
    lastItem: Y.XmlElement;
    indent: number;
    type: 'bullet' | 'ordered';
  }
  const listStack: ListContext[] = [];
  
  /** Get the indentation level of a line (number of leading spaces/tabs) */
  function getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    // Count tabs as 4 spaces
    return match[1].replace(/\t/g, '    ').length;
  }
  
  /** Clear the list stack */
  function clearListStack(): void {
    listStack.length = 0;
  }
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    const indent = getIndent(line);
    
    // Handle headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      clearListStack();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const heading = new Y.XmlElement('heading');
      heading.setAttribute('level', String(level));
      insertTextWithMarks(heading, text);
      fragment.insert(fragment.length, [heading]);
      continue;
    }
    
    // Check for bullet list item
    const bulletMatch = trimmedLine.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      const text = bulletMatch[1];
      
      // Pop stack entries deeper than current indent
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        listStack.pop();
      }
      
      const listItem = new Y.XmlElement('listItem');
      const paragraph = new Y.XmlElement('paragraph');
      insertTextWithMarks(paragraph, text);
      listItem.insert(0, [paragraph]);
      
      if (listStack.length > 0 && listStack[listStack.length - 1].indent === indent) {
        // Sibling: append to existing list at this level
        const current = listStack[listStack.length - 1];
        current.list.insert(current.list.length, [listItem]);
        current.lastItem = listItem;
      } else if (listStack.length > 0 && listStack[listStack.length - 1].indent < indent) {
        // Nested list: create sub-list inside parent's lastItem
        const parent = listStack[listStack.length - 1];
        const subList = new Y.XmlElement('bulletList');
        subList.insert(0, [listItem]);
        parent.lastItem.insert(parent.lastItem.length, [subList]);
        listStack.push({ list: subList, lastItem: listItem, indent, type: 'bullet' });
      } else {
        // Top-level bullet list
        const bulletList = new Y.XmlElement('bulletList');
        bulletList.insert(0, [listItem]);
        fragment.insert(fragment.length, [bulletList]);
        listStack.push({ list: bulletList, lastItem: listItem, indent, type: 'bullet' });
      }
      continue;
    }
    
    // Check for numbered list item
    const numberedMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      const text = numberedMatch[1];
      
      // Pop stack entries deeper than current indent
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        listStack.pop();
      }
      
      const listItem = new Y.XmlElement('listItem');
      const paragraph = new Y.XmlElement('paragraph');
      insertTextWithMarks(paragraph, text);
      listItem.insert(0, [paragraph]);
      
      if (listStack.length > 0 && listStack[listStack.length - 1].indent === indent) {
        // Sibling: append to existing list at this level
        const current = listStack[listStack.length - 1];
        current.list.insert(current.list.length, [listItem]);
        current.lastItem = listItem;
      } else if (listStack.length > 0 && listStack[listStack.length - 1].indent < indent) {
        // Nested list: create sub-list inside parent's lastItem
        const parent = listStack[listStack.length - 1];
        const subList = new Y.XmlElement('orderedList');
        subList.insert(0, [listItem]);
        parent.lastItem.insert(parent.lastItem.length, [subList]);
        listStack.push({ list: subList, lastItem: listItem, indent, type: 'ordered' });
      } else {
        // Top-level ordered list
        const orderedList = new Y.XmlElement('orderedList');
        orderedList.insert(0, [listItem]);
        fragment.insert(fragment.length, [orderedList]);
        listStack.push({ list: orderedList, lastItem: listItem, indent, type: 'ordered' });
      }
      continue;
    }
    
    // Any non-list line breaks the list context
    clearListStack();
    
    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      continue;
    }
    
    // Handle blockquotes
    if (trimmedLine.startsWith('> ')) {
      const text = trimmedLine.slice(2);
      const blockquote = new Y.XmlElement('blockquote');
      const paragraph = new Y.XmlElement('paragraph');
      insertTextWithMarks(paragraph, text);
      blockquote.insert(0, [paragraph]);
      fragment.insert(fragment.length, [blockquote]);
      continue;
    }
    
    // Handle horizontal rules
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      const hr = new Y.XmlElement('horizontalRule');
      fragment.insert(fragment.length, [hr]);
      continue;
    }
    
    // Regular paragraph (including empty lines as empty paragraphs)
    const paragraph = new Y.XmlElement('paragraph');
    if (trimmedLine) {
      insertTextWithMarks(paragraph, trimmedLine);
    }
    fragment.insert(fragment.length, [paragraph]);
  }
  
  console.log(`[Collab] Initialized Y.doc with ${fragment.length} elements from content`);
}

/**
 * Debounce storage for document saves
 * Maps documentName → timeout handle
 */
const saveTimeouts = new Map<string, NodeJS.Timeout>();
const pendingStates = new Map<string, Buffer>(); // Store pending states for flush on disconnect
const DEBOUNCE_DELAY = 2000; // 2 seconds

/**
 * Save document to database immediately (used for disconnect flush)
 */
async function saveDocumentToDatabase(documentName: string, state: Buffer): Promise<void> {
  try {
    const markdownContent = convertYjsToMarkdown(state);
    
    // Convert Buffer to base64 for proper BYTEA storage in Supabase
    const base64State = state.toString('base64');
    
    // Build update object - always save yjs_state, only update content if extracted
    const updateData: { yjs_state: string; updated_at: string; content?: string } = {
      yjs_state: base64State,
      updated_at: new Date().toISOString(),
    };
    
    if (markdownContent) {
      updateData.content = markdownContent;
      console.log(`[Collab] Saving ${documentName}: ${markdownContent.length} chars of content, ${state.length} bytes state`);
    } else {
      console.log(`[Collab] Saving ${documentName}: yjs_state only (${state.length} bytes), no markdown extracted`);
    }
    
    const { error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentName);

    if (updateError) {
      console.error(`[Collab] Error storing document ${documentName}:`, updateError);
      return;
    }

    console.log(`[Collab] Stored document ${documentName} to database`);
    pendingStates.delete(documentName);
  } catch (err: any) {
    console.error(`[Collab] Exception storing document ${documentName}:`, err.message);
  }
}

/**
 * Convert Y.js binary state to Markdown content
 * Handles TipTap's Y.js XML structure with inline formatting marks
 * @param state - Binary Y.js state buffer
 * @returns Markdown string or null if conversion fails
 */
function convertYjsToMarkdown(state: Buffer): string | null {
  try {
    // Validate state buffer
    if (!state || state.length === 0) {
      return null;
    }

    const ydoc = new Y.Doc();
    const uint8State = new Uint8Array(state);
    
    // Check for valid Y.js update format (should start with specific bytes)
    if (uint8State.length < 2) {
      return null;
    }
    
    Y.applyUpdate(ydoc, uint8State);
    
    // TipTap uses 'default' as the fragment name by default
    let xmlFragment = ydoc.getXmlFragment('default');
    
    // Try multiple possible fragment names if default is empty
    const sharedTypes = Array.from(ydoc.share.keys());
    if (sharedTypes.length > 0 && xmlFragment.length === 0) {
      for (const key of sharedTypes) {
        const type = ydoc.share.get(key);
        if (type instanceof Y.XmlFragment && type.length > 0) {
          xmlFragment = type;
          break;
        }
      }
    }
    
    // Check if fragment has any content
    if (xmlFragment.length === 0) {
      return null;
    }
    
    let listCounter = 0;
    let isOrderedList = false;
    
    /**
     * Extract text content from Y.XmlText with inline formatting marks
     */
    const extractFormattedText = (textNode: Y.XmlText): string => {
      const delta = textNode.toDelta();
      let result = '';
      
      for (const op of delta) {
        if (typeof op.insert !== 'string') continue;
        
        let text = op.insert;
        const attrs = op.attributes || {};
        
        // Apply inline formatting marks
        if (attrs.code) {
          text = `\`${text}\``;
        }
        if (attrs.bold) {
          text = `**${text}**`;
        }
        if (attrs.italic) {
          text = `*${text}*`;
        }
        if (attrs.strike) {
          text = `~~${text}~~`;
        }
        if (attrs.underline) {
          text = `_${text}_`;
        }
        if (attrs.link) {
          const href = typeof attrs.link === 'object' ? attrs.link.href : attrs.link;
          text = `[${text}](${href})`;
        }
        
        result += text;
      }
      
      return result;
    };
    
    /**
     * Recursively extract markdown from Y.js elements
     */
    const extractMarkdown = (element: Y.XmlElement | Y.XmlFragment, depth: number = 0): string => {
      let markdown = '';
      
      try {
        element.forEach((child) => {
          if (child instanceof Y.XmlText) {
            markdown += extractFormattedText(child);
          } else if (child instanceof Y.XmlElement) {
            const tagName = child.nodeName?.toLowerCase() || '';
            const childContent = extractMarkdown(child, depth + 1);
            
            switch (tagName) {
              case 'heading': {
                const level = parseInt(child.getAttribute('level') || '1', 10);
                markdown += '#'.repeat(Math.min(level, 6)) + ' ' + childContent.trim() + '\n\n';
                break;
              }
              
              case 'paragraph': {
                const trimmed = childContent.trim();
                if (trimmed) {
                  markdown += trimmed + '\n\n';
                }
                break;
              }
              
              case 'bulletlist': {
                isOrderedList = false;
                markdown += childContent;
                break;
              }
              
              case 'orderedlist': {
                isOrderedList = true;
                listCounter = 0;
                markdown += childContent;
                break;
              }
              
              case 'listitem': {
                const prefix = isOrderedList ? `${++listCounter}. ` : '- ';
                const lines = childContent.trim().split('\n');
                markdown += prefix + lines.join('\n  ') + '\n';
                break;
              }
              
              case 'tasklist': {
                markdown += childContent;
                break;
              }
              
              case 'taskitem': {
                const checked = child.getAttribute('checked') === 'true' ? 'x' : ' ';
                markdown += `- [${checked}] ${childContent.trim()}\n`;
                break;
              }
              
              case 'blockquote': {
                const lines = childContent.trim().split('\n');
                markdown += lines.map(line => '> ' + line).join('\n') + '\n\n';
                break;
              }
              
              case 'codeblock': {
                const language = child.getAttribute('language') || '';
                markdown += '```' + language + '\n' + childContent + '\n```\n\n';
                break;
              }
              
              case 'horizontalrule': {
                markdown += '---\n\n';
                break;
              }
              
              case 'image': {
                const src = child.getAttribute('src') || '';
                const alt = child.getAttribute('alt') || 'image';
                if (src) {
                  markdown += `![${alt}](${src})\n\n`;
                }
                break;
              }
              
              case 'table': {
                markdown += childContent + '\n';
                break;
              }
              
              case 'tablerow': {
                const cells = childContent.split('\t');
                markdown += '| ' + cells.join(' | ') + ' |\n';
                break;
              }
              
              case 'tablecell':
              case 'tableheader': {
                markdown += childContent.trim() + '\t';
                break;
              }
              
              case 'hardbreak': {
                markdown += '  \n';
                break;
              }
              
              default: {
                // For unknown elements, just include the content
                markdown += childContent;
              }
            }
          }
        });
      } catch (e) {
        // Silently handle iteration errors
      }
      
      return markdown;
    };
    
    let markdown = extractMarkdown(xmlFragment);
    
    // Clean up: normalize multiple blank lines to max 2
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
    
    return markdown || null;
  } catch (error: any) {
    // Only log if it's not an expected empty state error
    if (!error.message?.includes('Unexpected end') && !error.message?.includes('out of bounds')) {
      console.error('[Collab] Error converting Y.js to Markdown:', error.message);
    }
    return null;
  }
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
    const { documentName, document: ydoc } = data;

    try {
      const { data: dbDoc, error } = await supabase
        .from('documents')
        .select('yjs_state, tenant_id, content')
        .eq('id', documentName)
        .single();

      if (error) {
        console.error(`[Collab] Error loading document ${documentName}:`, error);
        return;
      }

      if (!dbDoc) {
        console.error(`[Collab] Document ${documentName} not found`);
        return;
      }

      if (dbDoc.yjs_state) {
        // Handle different possible formats from Supabase
        let stateBuffer: Buffer;
        const stateType = typeof dbDoc.yjs_state;
        console.log(`[Collab] yjs_state type: ${stateType}, first 20 chars: ${String(dbDoc.yjs_state).substring(0, 20)}`);
        
        if (Buffer.isBuffer(dbDoc.yjs_state)) {
          stateBuffer = dbDoc.yjs_state;
        } else if (dbDoc.yjs_state instanceof Uint8Array) {
          stateBuffer = Buffer.from(dbDoc.yjs_state);
        } else if (typeof dbDoc.yjs_state === 'string') {
          if (dbDoc.yjs_state.startsWith('\\x')) {
            // Supabase BYTEA returns hex-encoded data with \x prefix
            const hexContent = dbDoc.yjs_state.slice(2);
            // Decode hex to get the stored string (which is base64)
            const decodedString = Buffer.from(hexContent, 'hex').toString('utf8');
            
            // Check if it's old corrupted JSON Buffer format - fall through to content init
            if (decodedString.startsWith('{"type":"Buffer"')) {
              console.log(`[Collab] Detected corrupted JSON Buffer format, will try content init`);
              if (dbDoc.content && dbDoc.content.trim()) {
                console.log(`[Collab] Initializing Y.doc from content for ${documentName} (${dbDoc.content.length} chars)`);
                initializeYdocFromContent(ydoc, dbDoc.content);
              }
              return;
            }
            
            // The decoded string should be base64 - decode it to get actual Y.js state
            stateBuffer = Buffer.from(decodedString, 'base64');
            console.log(`[Collab] Decoded hex->base64->binary: ${stateBuffer.length} bytes`);
          } else {
            // Direct base64 format
            stateBuffer = Buffer.from(dbDoc.yjs_state, 'base64');
          }
        } else if (dbDoc.yjs_state.data) {
          // Supabase sometimes returns { type: 'Buffer', data: [...] }
          stateBuffer = Buffer.from(dbDoc.yjs_state.data);
        } else {
          stateBuffer = Buffer.from(dbDoc.yjs_state);
        }
        
        console.log(`[Collab] Loaded document ${documentName} from database (tenant: ${dbDoc.tenant_id}, state size: ${stateBuffer.length} bytes)`);
        
        // Apply the state to the Y.Doc directly
        Y.applyUpdate(ydoc, new Uint8Array(stateBuffer));
        console.log(`[Collab] Applied ${stateBuffer.length} bytes to Y.Doc for ${documentName}`);
        return;
      }

      console.log(`[Collab] No existing yjs_state for document ${documentName} (tenant: ${dbDoc.tenant_id}, has content: ${!!dbDoc.content})`);
      
      // If there's content but no yjs_state, initialize the Y.doc with the content
      if (dbDoc.content && dbDoc.content.trim()) {
        console.log(`[Collab] Initializing Y.doc from content for ${documentName} (${dbDoc.content.length} chars)`);
        initializeYdocFromContent(ydoc, dbDoc.content);
      }
    } catch (err: any) {
      console.error(`[Collab] Exception loading document ${documentName}:`, err.message);
    }
  },

  async onChange(data: any) {
    const { documentName, document } = data;
    
    // Get the Y.js state from the document
    const state = Buffer.from(Y.encodeStateAsUpdate(document));
    
    // Store pending state for flush on disconnect
    pendingStates.set(documentName, state);

    // Clear existing timeout for this document
    const existingTimeout = saveTimeouts.get(documentName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new debounced save
    const timeout = setTimeout(async () => {
      await saveDocumentToDatabase(documentName, state);
      saveTimeouts.delete(documentName);
    }, DEBOUNCE_DELAY);

    saveTimeouts.set(documentName, timeout);
  },

  async onConnect(data: any) {
    console.log(`[Collab] Client connected to document ${data.documentName}`);
  },

  async onDisconnect(data: any) {
    const { documentName } = data;
    console.log(`[Collab] Client disconnected from document ${documentName}`);
    
    // Cancel any pending debounced save
    const existingTimeout = saveTimeouts.get(documentName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      saveTimeouts.delete(documentName);
    }
    
    // Flush pending state immediately on disconnect
    const pendingState = pendingStates.get(documentName);
    if (pendingState) {
      console.log(`[Collab] Flushing pending changes for ${documentName} on disconnect`);
      await saveDocumentToDatabase(documentName, pendingState);
    }
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
