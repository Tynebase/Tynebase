"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "./extensions/ResizableImage";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Link as LinkIcon,
  Image as ImageIcon, Youtube as YoutubeIcon, Upload, Loader2, X
} from "lucide-react";

interface SimpleRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  discussionId?: string;
  onUploadAsset?: (file: File) => Promise<{ signed_url: string }>;
}

export function SimpleRichTextEditor({
  value,
  onChange,
  placeholder = "Write your content...",
  minHeight = "200px",
  discussionId,
  onUploadAsset,
}: SimpleRichTextEditorProps) {
  const [showImageInput, setShowImageInput] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close all dropdowns helper
  const closeAllDropdowns = useCallback(() => {
    setShowImageInput(false);
    setShowYoutubeInput(false);
    setShowLinkInput(false);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeAllDropdowns();
      }
    };
    
    if (showImageInput || showYoutubeInput || showLinkInput) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showImageInput, showYoutubeInput, showLinkInput, closeAllDropdowns]);

  const toggleLinkInput = () => {
    setShowImageInput(false);
    setShowYoutubeInput(false);
    setShowLinkInput(!showLinkInput);
  };

  const toggleImageInput = () => {
    setShowLinkInput(false);
    setShowYoutubeInput(false);
    setShowImageInput(!showImageInput);
  };

  const toggleYoutubeInput = () => {
    setShowLinkInput(false);
    setShowImageInput(false);
    setShowYoutubeInput(!showYoutubeInput);
  };
  const [imageUrl, setImageUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!onUploadAsset) return;
    setIsUploading(true);
    try {
      const response = await onUploadAsset(file);
      editorRef.current?.chain().focus().setImage({ src: response.signed_url }).run();
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadAsset]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--brand)] underline",
        },
      }),
      ResizableImage.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-4",
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: "w-full aspect-video rounded-lg my-4",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none p-4 text-[var(--dash-text-primary)]`,
        style: `min-height: ${minHeight}`,
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !onUploadAsset) return false;
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer?.files?.length) return false;
        const file = dataTransfer.files[0];
        if (!file.type.startsWith('image/')) return false;
        event.preventDefault();
        handleImageUpload(file);
        return true;
      },
      handlePaste: (view, event) => {
        if (!onUploadAsset) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        handleImageUpload(file);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div 
        className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg animate-pulse"
        style={{ minHeight }}
      />
    );
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? "bg-[var(--brand)] text-white"
          : "text-[var(--dash-text-secondary)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {children}
    </button>
  );

  const addLink = () => {
    if (linkUrl) {
      const hasSelection = !editor.state.selection.empty;
      
      if (hasSelection) {
        // If there's selected text, apply link to it
        editor.chain().focus().setLink({ href: linkUrl }).run();
      } else if (linkText) {
        // Insert link with custom text
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: linkText,
            marks: [{ type: 'link', attrs: { href: linkUrl } }],
          })
          .run();
      } else {
        // No selection and no link text - insert URL as the link text
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: linkUrl,
            marks: [{ type: 'link', attrs: { href: linkUrl } }],
          })
          .run();
      }
      setLinkUrl("");
      setLinkText("");
      setShowLinkInput(false);
    }
  };

  const addImageFromUrl = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setShowImageInput(false);
    }
  };

  const addYoutubeVideo = () => {
    if (youtubeUrl) {
      editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl("");
      setShowYoutubeInput(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
      setShowImageInput(false);
    }
    if (imageFileRef.current) imageFileRef.current.value = "";
  };

  return (
    <div className="border border-[var(--dash-border-subtle)] rounded-lg overflow-hidden bg-[var(--surface-card)] relative">
      {/* Drag overlay */}
      {isDragging && onUploadAsset && (
        <div className="absolute inset-0 bg-[var(--brand)]/10 border-2 border-dashed border-[var(--brand)] rounded-lg z-10 flex items-center justify-center">
          <div className="text-[var(--brand)] font-medium">Drop image here</div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div ref={dropdownRef} className="flex items-center gap-0.5 p-2 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-[var(--dash-border-subtle)] mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-[var(--dash-border-subtle)] mx-1" />

        {/* Link button */}
        <div className="relative">
          <ToolbarButton
            onClick={toggleLinkInput}
            isActive={editor.isActive("link") || showLinkInput}
            title="Add Link"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {showLinkInput && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg p-3 z-20 min-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">Add Link</span>
                <button onClick={() => setShowLinkInput(false)} className="text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-1.5 text-sm bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                />
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text (optional)"
                  className="w-full px-3 py-1.5 text-sm bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                />
                <button
                  onClick={addLink}
                  disabled={!linkUrl}
                  className="w-full px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  Add Link
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[var(--dash-border-subtle)] mx-1" />

        {/* Image button */}
        <div className="relative">
          <ToolbarButton
            onClick={toggleImageInput}
            isActive={showImageInput}
            title="Add Image"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </ToolbarButton>
          {showImageInput && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg p-3 z-20 min-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">Add Image</span>
                <button onClick={() => setShowImageInput(false)} className="text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {onUploadAsset && (
                <button
                  onClick={() => imageFileRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload from device
                </button>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="flex-1 px-3 py-1.5 text-sm bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  onKeyDown={(e) => e.key === 'Enter' && addImageFromUrl()}
                />
                <button
                  onClick={addImageFromUrl}
                  disabled={!imageUrl}
                  className="px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* YouTube button */}
        <div className="relative">
          <ToolbarButton
            onClick={toggleYoutubeInput}
            isActive={showYoutubeInput}
            title="Embed YouTube Video"
          >
            <YoutubeIcon className="w-4 h-4" />
          </ToolbarButton>
          {showYoutubeInput && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg p-3 z-20 min-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">Embed YouTube</span>
                <button onClick={() => setShowYoutubeInput(false)} className="text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste YouTube URL..."
                  className="flex-1 px-3 py-1.5 text-sm bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  onKeyDown={(e) => e.key === 'Enter' && addYoutubeVideo()}
                />
                <button
                  onClick={addYoutubeVideo}
                  disabled={!youtubeUrl}
                  className="px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
