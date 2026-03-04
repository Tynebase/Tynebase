"use client";

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
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { FontSize } from "@/components/editor/extensions/FontSize";
import { FontFamily } from "@/components/editor/extensions/FontFamily";
import { Video } from "@/components/editor/extensions/Video";

const lowlight = createLowlight(common);

interface TiptapReaderProps {
  content: string;
  title?: string;
  className?: string;
}

/**
 * Read-only TipTap renderer for displaying document content.
 * Uses the same extensions as RichTextEditor to ensure proper rendering
 * of custom nodes like resizableimage, video embeds, etc.
 */
export function TiptapReader({ content, title, className = "" }: TiptapReaderProps) {
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
    Markdown.configure({
      html: true,
      transformPastedText: false,
      transformCopiedText: false,
    }),
  ];

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: content || "",
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
        <div className="px-8 md:px-16 py-8 md:py-12">
          {title && (
            <h1 
              className="text-3xl font-bold mb-8 pb-4 border-b" 
              style={{ color: 'var(--dash-text-primary)', borderColor: 'var(--dash-border-default)' }}
            >
              {title}
            </h1>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
