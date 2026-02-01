import { Editor } from '@tiptap/react';

export type ExportFormat = 'markdown' | 'docx' | 'pdf';

/**
 * Get markdown content from the TipTap editor
 */
export function getMarkdownContent(editor: Editor): string {
  // The editor has tiptap-markdown extension, use storage to get markdown
  const markdown = editor.storage.markdown?.getMarkdown?.() || editor.getText();
  return markdown;
}

/**
 * Normalize markdown for pretty export
 * - Clean up extra whitespace
 * - Ensure consistent heading spacing
 * - Format lists properly
 */
export function normalizeMarkdown(markdown: string, title?: string): string {
  let content = markdown;
  
  // Add title as H1 if provided
  if (title) {
    content = `# ${title}\n\n${content}`;
  }
  
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');
  
  // Remove excessive blank lines (more than 2 consecutive)
  content = content.replace(/\n{3,}/g, '\n\n');
  
  // Ensure headings have blank line before them (except at start)
  content = content.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  
  // Ensure code blocks have proper spacing
  content = content.replace(/([^\n])\n```/g, '$1\n\n```');
  content = content.replace(/```\n([^\n])/g, '```\n\n$1');
  
  // Trim trailing whitespace from each line
  content = content.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Ensure file ends with single newline
  content = content.trimEnd() + '\n';
  
  return content;
}

/**
 * Download a file with the given content
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export document as Markdown
 */
export function exportAsMarkdown(editor: Editor, title: string): void {
  const markdown = getMarkdownContent(editor);
  const normalizedContent = normalizeMarkdown(markdown, title);
  const filename = sanitizeFilename(title) + '.md';
  downloadFile(normalizedContent, filename, 'text/markdown');
}

/**
 * Export document as DOCX using docx library
 */
export async function exportAsDocx(editor: Editor, title: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
  
  const markdown = getMarkdownContent(editor);
  const lines = markdown.split('\n');
  const children: any[] = [];
  
  // Add title
  children.push(new Paragraph({
    text: title || 'Untitled Document',
    heading: HeadingLevel.TITLE,
    spacing: { after: 400 },
  }));
  
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        children.push(new Paragraph({
          children: [new TextRun({ text: codeBlockContent.join('\n'), font: 'Courier New', size: 20 })],
          shading: { fill: 'E8E8E8' },
          spacing: { before: 200, after: 200 },
        }));
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Skip empty lines
    if (!line.trim()) {
      if (inList) {
        inList = false;
      }
      continue;
    }
    
    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingLevel = level === 1 ? HeadingLevel.HEADING_1 
        : level === 2 ? HeadingLevel.HEADING_2 
        : level === 3 ? HeadingLevel.HEADING_3 
        : level === 4 ? HeadingLevel.HEADING_4 
        : level === 5 ? HeadingLevel.HEADING_5 
        : HeadingLevel.HEADING_6;
      
      children.push(new Paragraph({
        text: parseInlineFormatting(text),
        heading: headingLevel,
        spacing: { before: 300, after: 200 },
      }));
      continue;
    }
    
    // Handle bullet lists
    if (line.match(/^[\-\*]\s+/)) {
      const text = line.replace(/^[\-\*]\s+/, '');
      children.push(new Paragraph({
        children: createFormattedRuns(text),
        bullet: { level: 0 },
      }));
      continue;
    }
    
    // Handle numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      children.push(new Paragraph({
        children: createFormattedRuns(numberedMatch[2]),
        numbering: { reference: 'default-numbering', level: 0 },
      }));
      continue;
    }
    
    // Handle blockquotes
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s*/, '');
      children.push(new Paragraph({
        children: [new TextRun({ text, italics: true, color: '666666' })],
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'CCCCCC' } },
        spacing: { before: 100, after: 100 },
      }));
      continue;
    }
    
    // Handle horizontal rules
    if (line.match(/^[\-\*_]{3,}$/)) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }
    
    // Regular paragraph
    children.push(new Paragraph({
      children: createFormattedRuns(line),
      spacing: { after: 200 },
    }));
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
        }],
      }],
    },
  });
  
  const blob = await Packer.toBlob(doc);
  const filename = sanitizeFilename(title) + '.docx';
  downloadFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/**
 * Create formatted TextRuns from markdown text with inline formatting
 */
function createFormattedRuns(text: string): any[] {
  const { TextRun } = require('docx');
  const runs: any[] = [];
  
  // Simple regex-based parsing for bold, italic, code
  let remaining = text;
  
  while (remaining.length > 0) {
    // Bold + Italic
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) {
      runs.push(new TextRun({ text: boldItalicMatch[1], bold: true, italics: true }));
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }
    
    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      runs.push(new TextRun({ text: boldMatch[1], bold: true }));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    
    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      runs.push(new TextRun({ text: italicMatch[1], italics: true }));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    // Inline code
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      runs.push(new TextRun({ text: codeMatch[1], font: 'Courier New', shading: { fill: 'E8E8E8' } }));
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    
    // Link
    const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
    if (linkMatch) {
      runs.push(new TextRun({ text: linkMatch[1], color: '0066CC', underline: {} }));
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    
    // Regular text - find next special character or end
    const nextSpecial = remaining.search(/[\*`\[]/);
    if (nextSpecial === -1) {
      runs.push(new TextRun({ text: remaining }));
      break;
    } else if (nextSpecial === 0) {
      // Special char but no match - treat as regular text
      runs.push(new TextRun({ text: remaining[0] }));
      remaining = remaining.slice(1);
    } else {
      runs.push(new TextRun({ text: remaining.slice(0, nextSpecial) }));
      remaining = remaining.slice(nextSpecial);
    }
  }
  
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

/**
 * Parse inline formatting to plain text (for headings)
 */
function parseInlineFormatting(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Export document as PDF using html2pdf
 */
export async function exportAsPdf(editor: Editor, title: string): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  
  // Get HTML content from editor
  const htmlContent = editor.getHTML();
  
  // Create a container with proper styling
  const container = document.createElement('div');
  container.innerHTML = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
      <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 24px; color: #111;">${title || 'Untitled Document'}</h1>
      <div class="pdf-content" style="font-size: 14px; line-height: 1.7; color: #333;">
        ${htmlContent}
      </div>
    </div>
  `;
  
  // Add custom styles for PDF
  const style = document.createElement('style');
  style.textContent = `
    .pdf-content h1 { font-size: 24px; font-weight: 700; margin: 24px 0 16px; color: #111; }
    .pdf-content h2 { font-size: 20px; font-weight: 600; margin: 20px 0 12px; color: #222; }
    .pdf-content h3 { font-size: 18px; font-weight: 600; margin: 16px 0 10px; color: #333; }
    .pdf-content p { margin: 0 0 12px; }
    .pdf-content ul, .pdf-content ol { margin: 12px 0; padding-left: 24px; }
    .pdf-content li { margin: 4px 0; }
    .pdf-content blockquote { border-left: 4px solid #ddd; margin: 16px 0; padding-left: 16px; color: #666; font-style: italic; }
    .pdf-content pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 13px; }
    .pdf-content code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; }
    .pdf-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
    .pdf-content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .pdf-content th, .pdf-content td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .pdf-content th { background: #f5f5f5; font-weight: 600; }
    .pdf-content hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    .pdf-content a { color: #0066cc; text-decoration: underline; }
  `;
  container.prepend(style);
  
  const options = {
    margin: [15, 15, 15, 15] as [number, number, number, number],
    filename: sanitizeFilename(title) + '.pdf',
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false,
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' as const
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };
  
  await html2pdf().set(options).from(container).save();
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(title: string): string {
  if (!title || !title.trim()) {
    return 'Untitled-Document';
  }
  return title
    .trim()
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Remove consecutive dashes
    .substring(0, 100); // Limit length
}
