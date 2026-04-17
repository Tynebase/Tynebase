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
import { common, createLowlight } from "lowlight";
import { FontSize } from "@/components/editor/extensions/FontSize";
import { FontFamily } from "@/components/editor/extensions/FontFamily";
import { Video } from "@/components/editor/extensions/Video";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { marked } from "marked";

// Custom NodeView for Video in read-only mode that converts YouTube URLs
const VideoNodeViewReadonly = ({ node }: any) => {
  const { src, videoType } = node.attrs;

  // Convert YouTube URL to embed format
  const getYouTubeEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/embed/')) return url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  // Stronger YouTube detection - check URL patterns first
  const isYouTube = src && (
    videoType === 'youtube' ||
    src.includes('youtube.com/embed') ||
    src.includes('youtube.com/watch') ||
    src.includes('youtu.be/')
  );

  const embedSrc = isYouTube ? getYouTubeEmbedUrl(src) : src;

  if (isYouTube) {
    return (
      <iframe
        src={embedSrc}
        title={node.attrs.title || 'YouTube video'}
        className="w-full rounded-lg"
        style={{ height: '400px' }}
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={src}
      title={node.attrs.title}
      controls
      preload="metadata"
      className="w-full rounded-lg"
      style={{ maxHeight: '500px' }}
    />
  );
};

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
    Video.extend({
      addNodeView() {
        return ReactNodeViewRenderer(VideoNodeViewReadonly);
      },
      parseHTML() {
        return [
          {
            tag: 'div[data-video]',
            getAttrs: node => {
              const el = node as HTMLElement;
              const iframe = el.querySelector('iframe');
              const video = el.querySelector('video');
              
              if (iframe) {
                const src = iframe.getAttribute('src');
                if (src && (src.includes('youtube.com/embed') || src.includes('youtu.be'))) {
                  return { src, videoType: 'youtube' };
                }
              }
              
              if (video) {
                const src = video.getAttribute('src');
                if (src) return { src, videoType: 'uploaded' };
              }
              
              return false;
            },
          },
          {
            tag: 'video[src]',
            getAttrs: node => {
              const el = node as HTMLElement;
              const src = el.getAttribute('src');
              const videoType = el.getAttribute('data-video-type') || 'uploaded';
              return { src, videoType };
            },
          },
          {
            tag: 'iframe[src]',
            getAttrs: node => {
              const src = (node as HTMLElement).getAttribute('src');
              if (src && (src.includes('youtube.com/embed') || src.includes('youtu.be'))) {
                return { src, videoType: 'youtube' };
              }
              return false;
            },
          },
          {
            // Handle legacy TipTap Youtube extension tags
            tag: 'youtube',
            getAttrs: node => {
              const el = node as HTMLElement;
              const src = el.getAttribute('src');
              if (!src) return false;
              
              // Convert YouTube watch URL to embed URL
              const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
              const match = src.match(regExp);
              const videoId = match && match[2].length === 11 ? match[2] : null;
              const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : src;
              
              return {
                src: embedUrl,
                videoType: 'youtube',
                title: el.getAttribute('title') || null,
              };
            },
          },
        ];
      },
    }).configure({ HTMLAttributes: { class: "video-wrapper" } }),
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
            /* Hyperlink styles */
            .tiptap-reader a {
              color: var(--brand) !important;
              text-decoration: underline !important;
              text-underline-offset: 4px;
              cursor: pointer !important;
              transition: opacity 0.2s;
            }
            .tiptap-reader a:hover {
              opacity: 0.8;
            }
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
