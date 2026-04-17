/**
 * HTML to Markdown Conversion Utility
 * 
 * Converts HTML content from the rich text editor to Markdown format
 * for storage and RAG processing.
 * 
 * Uses Turndown library for reliable conversion.
 */

import TurndownService from 'turndown';

// Create singleton instance with custom rules
let turndownInstance: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = new TurndownService({
      headingStyle: 'atx',           // Use # style headings
      hr: '---',                      // Horizontal rules
      bulletListMarker: '-',          // Bullet list style
      codeBlockStyle: 'fenced',       // Use ``` for code blocks
      emDelimiter: '*',               // Use * for emphasis
      strongDelimiter: '**',          // Use ** for bold
      linkStyle: 'inlined',           // Inline links
    });

    // Add custom rule for underline (not native MD, convert to emphasis)
    turndownInstance.addRule('underline', {
      filter: ['u'],
      replacement: (content) => `_${content}_`,
    });

    // Add custom rule for strikethrough
    turndownInstance.addRule('strikethrough', {
      filter: (node) => {
        const tagName = node.nodeName.toLowerCase();
        return tagName === 's' || tagName === 'strike' || tagName === 'del';
      },
      replacement: (content) => `~~${content}~~`,
    });

    // Add custom rule for task lists
    turndownInstance.addRule('taskList', {
      filter: (node) => {
        return (
          node.nodeName === 'LI' &&
          node.parentNode?.nodeName === 'UL' &&
          (node as HTMLElement).querySelector('input[type="checkbox"]') !== null
        );
      },
      replacement: (content, node) => {
        const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
        const checked = checkbox?.hasAttribute('checked') ? 'x' : ' ';
        const text = content.replace(/^\s*\[.\]\s*/, '').trim();
        return `- [${checked}] ${text}\n`;
      },
    });

    // Preserve line breaks in paragraphs
    turndownInstance.addRule('lineBreaks', {
      filter: 'br',
      replacement: () => '  \n',
    });

    // Preserve custom TipTap container divs (like data-video or data-youtube-video)
    turndownInstance.addRule('preserveCustomDivs', {
      filter: (node) => {
        if (node.nodeName !== 'DIV') return false;
        return node.hasAttribute('data-video') || node.hasAttribute('data-youtube-video');
      },
      replacement: (content, node) => {
        return `\n\n${(node as HTMLElement).outerHTML}\n\n`;
      }
    });

    // Ask Turndown to keep raw HTML for these tags instead of stripping them
    turndownInstance.keep(['video', 'iframe']);
  }
  
  return turndownInstance;
}

/**
 * Convert HTML content to Markdown
 * 
 * @param html - HTML string from the editor
 * @returns Markdown formatted string
 */
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html || html.trim() === '') {
    return '';
  }

  const turndown = getTurndownService();
  
  try {
    // Clean up the HTML before conversion
    let cleanedHtml = html
      // Remove empty paragraphs
      .replace(/<p>\s*<\/p>/gi, '')
      // Normalize multiple spaces
      .replace(/&nbsp;/g, ' ')
      // Decode common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const markdown = turndown.turndown(cleanedHtml);
    
    // Post-process: normalize multiple blank lines to max 2
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error);
    // Fallback: return stripped HTML as plain text
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h\d>/gi, '\n\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

/**
 * Check if content appears to be HTML
 * 
 * @param content - Content string to check
 * @returns true if content appears to be HTML
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}
