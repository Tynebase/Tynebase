"use client";

import { useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "@/components/editor/extensions/ResizableImage";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
import { common, createLowlight } from "lowlight";
import { FontSize } from "@/components/editor/extensions/FontSize";
import { FontFamily } from "@/components/editor/extensions/FontFamily";
import { Video } from "@/components/editor/extensions/Video";
import { marked } from "marked";

const lowlight = createLowlight(common);

// Configure marked for GFM (tables, strikethrough, etc.)
marked.setOptions({ gfm: true, breaks: false });

interface TiptapReaderProps {
  content: string;
  title?: string;
  className?: string;
  isHtml?: boolean;
}

/**
 * Convert Markdown content to HTML so TipTap can parse it natively
 * using each extension's parseHTML rules. This is necessary because
 * the tiptap-markdown extension maps ![alt](url) to node type "image",
 * but our ResizableImage extension uses the name "resizableImage".
 * By converting to HTML first, TipTap's DOMParser uses parseHTML rules
 * which ResizableImage inherits from Image (matching <img> tags).
 */
function markdownToHtml(raw: string): string {
  if (!raw) return "";
  // Convert any remaining Markdown image syntax to img tags
  // (in case content was saved before the collab server fix)
  let processed = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // Wrap bare YouTube iframes with div[data-youtube-video] for TipTap's YouTube extension
  // Matches <iframe> not already inside a div[data-youtube-video]
  processed = processed.replace(
    /(?<!<div data-youtube-video>)(<iframe\s[^>]*(?:youtube\.com|youtu\.be)[^>]*><\/iframe>)/g,
    '<div data-youtube-video>$1</div>'
  );
  // Convert Markdown to HTML using marked
  const html = marked.parse(processed);
  return typeof html === "string" ? html : "";
}

/**
 * Read-only TipTap renderer for displaying document content.
 * Uses the same extensions as RichTextEditor to ensure proper rendering
 * of custom nodes like resizableimage, video embeds, etc.
 * Content is converted from Markdown to HTML before passing to TipTap
 * so native parseHTML rules handle all node types correctly.
 */
export function TiptapReader({ content, title, className = "", isHtml = false }: TiptapReaderProps) {
  const htmlContent = useMemo(() => isHtml ? (content || "") : markdownToHtml(content), [content, isHtml]);

  const extensions = [
    StarterKit.configure({ history: false, codeBlock: false }),
    Underline,
    Link.configure({ openOnClick: true }),
    ResizableImage.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-lg my-4" } }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Typography,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    TextStyle,
    Color,
    FontSize,
    FontFamily,
    Youtube.configure({ HTMLAttributes: { class: "w-full aspect-video rounded-lg my-4" } }),
    Video.configure({ HTMLAttributes: { class: "video-wrapper" } }),
  ];

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: htmlContent,
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none",
      },
    },
  });

  return (
    <div className={`bg-[var(--surface-ground)] rounded-xl overflow-hidden ${className}`}>
      <div 
        className="w-full shadow-xl rounded-sm"
        style={{ backgroundColor: 'var(--surface-card)' }}
      >
        <div className="px-8 md:px-16 py-8 md:py-12 overflow-hidden">
          <style>{`
            .tiptap-reader .resizable-image-wrapper {
              float: none !important;
              display: block !important;
              max-width: 100% !important;
              margin: 1rem auto !important;
              position: relative !important;
            }
            .tiptap-reader .resizable-image-wrapper img {
              max-width: 100% !important;
              height: auto !important;
              border-radius: 0.5rem;
            }
            /* Hide resize handles and selection UI in read-only mode */
            .tiptap-reader .resizable-image-wrapper > div {
              display: none !important;
            }
            .tiptap-reader .resizable-image-wrapper.selected > div {
              display: none !important;
            }
            /* Style for div tables (previously markdown tables) */
            .tiptap-reader div[style*="display: grid"] {
              display: grid !important;
              gap: 1px !important;
              background-color: var(--border-subtle) !important;
              border-radius: 8px !important;
              overflow: hidden !important;
              margin: 16px 0 !important;
              border: 3px solid var(--text-primary) !important;
            }
            .tiptap-reader div[style*="display: grid"] > div {
              padding: 12px 16px !important;
              background-color: var(--surface-card) !important;
              color: var(--text-primary) !important;
              font-weight: 400 !important;
              word-break: break-word;
              min-height: 44px;
              display: block !important;
              align-items: flex-start !important;
            }
            /* Header row cells - target via attribute selectors */
            .tiptap-reader div[style*="display: grid"] > div[style*="background: #f9fafb"],
            .tiptap-reader div[style*="display: grid"] > div[style*="font-weight: 600"] {
              background-color: var(--bg-secondary) !important;
              font-weight: 600 !important;
              color: var(--text-primary) !important;
            }
            /* Data cells with white background */
            .tiptap-reader div[style*="display: grid"] > div[style*="background: white"] {
              background-color: var(--surface-card) !important;
            }
            /* Zebra striping for better readability */
            .tiptap-reader div[style*="display: grid"] > div:nth-child(2n) {
              background-color: var(--surface-card-hover) !important;
            }
            /* Ensure header row stays distinct */
            .tiptap-reader div[style*="display: grid"] > div[style*="background: #f9fafb"],
            .tiptap-reader div[style*="display: grid"] > div[style*="font-weight: 600"] {
              background-color: var(--bg-secondary) !important;
            }
            /* Remove flex display that caused misalignment */
          `}</style>
          {title && (
            <h1 
              className="text-3xl font-bold mb-8 pb-4 border-b" 
              style={{ color: 'var(--dash-text-primary)', borderColor: 'var(--dash-border-default)' }}
            >
              {title}
            </h1>
          )}
          <div className="tiptap-reader">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
