/**
 * Semantic Chunking Service
 * Implements structure-aware semantic chunking for optimal RAG performance
 * 
 * Strategy: Four-pass hybrid approach
 * 1. Split by document structure (headings, sections)
 * 2. Apply semantic chunking within large sections
 * 3. Merge small adjacent chunks if semantically similar
 * 4. Add contextual prefix to each chunk
 * 
 * Target: +50-70% accuracy improvement over baseline
 */

/**
 * Chunking configuration based on PRD requirements
 * Using word-based sizing for optimal RAG performance
 */
export const CHUNKING_CONFIG = {
  TARGET_CHUNK_SIZE: 600, // words (optimal balance between context and precision)
  OVERLAP_SIZE: 50, // words (for context continuity)
  MIN_CHUNK_SIZE: 100, // words (avoid tiny chunks - PRD requirement)
  MAX_CHUNK_SIZE: 1000, // words (hard limit - PRD requirement)
  SEMANTIC_SIMILARITY_THRESHOLD: 0.85, // for merging adjacent chunks
  WORDS_PER_TOKEN: 0.75, // approximate conversion (1 token ≈ 0.75 words)
};

/**
 * Markdown structure patterns for semantic boundaries
 */
const MARKDOWN_PATTERNS = {
  // Heading levels (H1-H6)
  HEADING: /^(#{1,6})\s+(.+)$/gm,
  // Horizontal rules
  HR: /^(\*{3,}|-{3,}|_{3,})$/gm,
  // Code blocks
  CODE_BLOCK: /^```[\s\S]*?^```$/gm,
  // Lists (ordered and unordered)
  LIST_ITEM: /^(\s*[-*+]|\s*\d+\.)\s+/gm,
  // Blockquotes
  BLOCKQUOTE: /^>\s+/gm,
  // Tables
  TABLE_ROW: /^\|.+\|$/gm,
  // Paragraph breaks (2+ newlines)
  PARAGRAPH_BREAK: /\n\n+/g,
};

/**
 * Chunk interface with metadata
 */
export interface SemanticChunk {
  content: string;
  index: number;
  metadata: {
    heading?: string;
    level?: number;
    type?: 'heading' | 'paragraph' | 'list' | 'code' | 'table';
    tokenCount: number;
    hasContext: boolean;
  };
}

/**
 * Document section interface
 */
interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extracts document structure (headings and sections)
 * First pass: Split by document structure
 */
function extractDocumentStructure(markdown: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: DocumentSection | null = null;
  let contentBuffer: string[] = [];
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        currentSection.endIndex = lineIndex;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: '',
        startIndex: lineIndex,
        endIndex: lineIndex,
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(line);
    } else {
      // Content before first heading
      contentBuffer.push(line);
    }

    lineIndex++;
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    currentSection.endIndex = lineIndex;
    sections.push(currentSection);
  } else if (contentBuffer.length > 0) {
    // Document with no headings
    sections.push({
      heading: '',
      level: 0,
      content: contentBuffer.join('\n').trim(),
      startIndex: 0,
      endIndex: lineIndex,
    });
  }

  return sections;
}

/**
 * Estimates word count from text
 */
function estimateWordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Estimates token count from word count
 */
function estimateTokenCount(text: string): number {
  const wordCount = estimateWordCount(text);
  return Math.ceil(wordCount / CHUNKING_CONFIG.WORDS_PER_TOKEN);
}

/**
 * Splits text at semantic boundaries (paragraphs, lists, code blocks)
 * Second pass: Apply semantic chunking within large sections
 */
function splitAtSemanticBoundaries(text: string, targetSize: number): string[] {
  const chunks: string[] = [];
  
  // Split by paragraph breaks first
  const paragraphs = text.split(MARKDOWN_PATTERNS.PARAGRAPH_BREAK).filter(p => p.trim());
  
  let currentChunk = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = estimateWordCount(paragraph);
    
    // If paragraph alone exceeds max size, split it further
    if (paragraphWords > CHUNKING_CONFIG.MAX_CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split large paragraph by sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      for (const sentence of sentences) {
        const sentenceWords = estimateWordCount(sentence);
        
        if (currentTokens + sentenceWords > targetSize && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
          currentTokens = sentenceWords;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentTokens += sentenceWords;
        }
      }
    }
    // If adding paragraph would exceed target, save current chunk
    else if (currentTokens + paragraphWords > targetSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
      currentTokens = paragraphWords;
    }
    // Add paragraph to current chunk
    else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphWords;
    }
  }

  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Adds overlap between chunks for context continuity
 */
function addOverlap(chunks: string[], overlapWords: number): string[] {
  if (chunks.length <= 1) return chunks;

  const overlappedChunks: string[] = [];
  const overlapChars = overlapWords * 5; // Approximate chars per word

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];

    // Add overlap from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.slice(-overlapChars);
      // Find last sentence boundary in overlap
      const lastSentence = overlapText.lastIndexOf('. ');
      if (lastSentence > 0) {
        chunk = overlapText.slice(lastSentence + 2) + '\n\n' + chunk;
      }
    }

    overlappedChunks.push(chunk);
  }

  return overlappedChunks;
}

/**
 * Merges small adjacent chunks if they're below minimum size
 * Third pass: Merge small adjacent chunks
 */
function mergeSmallChunks(chunks: string[], minSize: number): string[] {
  if (chunks.length === 0) return [];
  
  const merged: string[] = [];
  let currentChunk = chunks[0];
  let currentWordCount = estimateWordCount(currentChunk);

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const wordCount = estimateWordCount(chunk);
    const combinedWordCount = currentWordCount + wordCount;
    
    // Merge if current chunk is too small OR next chunk is too small AND combined size is reasonable
    if ((currentWordCount < minSize || wordCount < minSize) && combinedWordCount <= CHUNKING_CONFIG.MAX_CHUNK_SIZE) {
      currentChunk += '\n\n' + chunk;
      currentWordCount = combinedWordCount;
    } else {
      merged.push(currentChunk);
      currentChunk = chunk;
      currentWordCount = wordCount;
    }
  }

  // Add the last chunk
  if (currentChunk) {
    merged.push(currentChunk);
  }

  return merged;
}

/**
 * Adds contextual prefix to chunk
 * Fourth pass: Add contextual prefix (document title + parent heading)
 */
function addContextualPrefix(
  chunk: string,
  documentTitle: string,
  heading?: string
): string {
  const prefix: string[] = [];

  if (documentTitle) {
    prefix.push(`Document: ${documentTitle}`);
  }

  if (heading) {
    prefix.push(`Section: ${heading}`);
  }

  if (prefix.length > 0) {
    return prefix.join('\n') + '\n\n' + chunk;
  }

  return chunk;
}

/**
 * Main semantic chunking function
 * Implements four-pass hybrid approach for optimal RAG performance
 * 
 * @param markdown - Markdown content to chunk
 * @param documentTitle - Document title for context
 * @returns Array of semantic chunks with metadata
 */
export function chunkMarkdownSemanticaly(
  markdown: string,
  documentTitle: string = ''
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  // Pass 1: Extract document structure
  const sections = extractDocumentStructure(markdown);

  for (const section of sections) {
    if (!section.content.trim()) continue;

    const sectionWords = estimateWordCount(section.content);

    // If section is small enough, keep it as one chunk
    if (sectionWords <= CHUNKING_CONFIG.TARGET_CHUNK_SIZE) {
      const content = addContextualPrefix(
        section.content,
        documentTitle,
        section.heading
      );

      chunks.push({
        content,
        index: chunkIndex++,
        metadata: {
          heading: section.heading || undefined,
          level: section.level || undefined,
          type: section.heading ? 'heading' : 'paragraph',
          tokenCount: estimateTokenCount(content),
          hasContext: true,
        },
      });
    }
    // Pass 2: Split large sections at semantic boundaries
    else {
      const sectionChunks = splitAtSemanticBoundaries(
        section.content,
        CHUNKING_CONFIG.TARGET_CHUNK_SIZE
      );

      // Pass 3: Add overlap between chunks
      const overlappedChunks = addOverlap(
        sectionChunks,
        CHUNKING_CONFIG.OVERLAP_SIZE
      );

      // Pass 4: Merge small chunks and add context
      const mergedChunks = mergeSmallChunks(
        overlappedChunks,
        CHUNKING_CONFIG.MIN_CHUNK_SIZE
      );

      for (const chunk of mergedChunks) {
        const content = addContextualPrefix(
          chunk,
          documentTitle,
          section.heading
        );

        chunks.push({
          content,
          index: chunkIndex++,
          metadata: {
            heading: section.heading || undefined,
            level: section.level || undefined,
            type: 'paragraph',
            tokenCount: estimateTokenCount(content),
            hasContext: true,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * Validates chunk quality
 * Ensures chunks meet minimum quality standards
 */
export function validateChunks(chunks: SemanticChunk[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const chunk of chunks) {
    // Check minimum size
    if (chunk.metadata.tokenCount < CHUNKING_CONFIG.MIN_CHUNK_SIZE) {
      issues.push(`Chunk ${chunk.index} is too small (${chunk.metadata.tokenCount} tokens)`);
    }

    // Check maximum size
    if (chunk.metadata.tokenCount > CHUNKING_CONFIG.MAX_CHUNK_SIZE) {
      issues.push(`Chunk ${chunk.index} is too large (${chunk.metadata.tokenCount} tokens)`);
    }

    // Check content is not empty
    if (!chunk.content.trim()) {
      issues.push(`Chunk ${chunk.index} is empty`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Gets chunking statistics
 */
export function getChunkingStats(chunks: SemanticChunk[]): {
  totalChunks: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  chunksWithContext: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
      chunksWithContext: 0,
    };
  }

  const tokenCounts = chunks.map(c => c.metadata.tokenCount);
  const chunksWithContext = chunks.filter(c => c.metadata.hasContext).length;

  return {
    totalChunks: chunks.length,
    avgTokensPerChunk: Math.round(
      tokenCounts.reduce((a, b) => a + b, 0) / chunks.length
    ),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    chunksWithContext,
  };
}
