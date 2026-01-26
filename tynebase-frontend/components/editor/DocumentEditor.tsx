"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
  Table,
  Minus,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckSquare,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentEditorProps {
  initialTitle?: string;
  initialContent?: string;
  onSave?: (data: { title: string; content: string }) => void;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  readOnly?: boolean;
  autoSave?: boolean;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarButton({ icon, label, onClick, active, disabled }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2 rounded-md transition-colors ${
        active 
          ? "bg-[var(--brand-primary)] text-white" 
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-[var(--border-subtle)] mx-1" />;
}

export function DocumentEditor({
  initialTitle = "",
  initialContent = "",
  onSave,
  onTitleChange,
  onContentChange,
  readOnly = false,
  autoSave = true,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate word and character count
  useEffect(() => {
    const text = editorRef.current?.innerText || content;
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    setCharCount(text.length);
  }, [content]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || readOnly) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const currentContent = editorRef.current?.innerHTML || content;
      onSave?.({ title, content: currentContent });
      setLastSaved(new Date());
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [title, content, autoSave, readOnly, onSave]);

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    
    setIsSaving(true);
    try {
      await onSave?.({ title, content: editorRef.current?.innerHTML || content });
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [title, content, onSave, readOnly]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    onTitleChange?.(e.target.value);
  };

  const handleContentChange = () => {
    const html = editorRef.current?.innerHTML || "";
    setContent(html);
    onContentChange?.(html);
  };

  // Formatting commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentChange();
  };

  const formatBlock = (tag: string) => {
    execCommand("formatBlock", tag);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      execCommand("insertImage", url);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-[var(--border-subtle)] bg-[var(--surface-ground)] flex-wrap">
        {/* Text Style Dropdown */}
        <div className="relative">
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-card)] rounded-md">
            Paragraph
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <ToolbarDivider />

        {/* Basic Formatting */}
        <ToolbarButton 
          icon={<Bold className="w-4 h-4" />} 
          label="Bold (Ctrl+B)" 
          onClick={() => execCommand("bold")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Italic className="w-4 h-4" />} 
          label="Italic (Ctrl+I)" 
          onClick={() => execCommand("italic")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Underline className="w-4 h-4" />} 
          label="Underline (Ctrl+U)" 
          onClick={() => execCommand("underline")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Strikethrough className="w-4 h-4" />} 
          label="Strikethrough" 
          onClick={() => execCommand("strikeThrough")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Code className="w-4 h-4" />} 
          label="Code" 
          onClick={() => formatBlock("pre")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton 
          icon={<Heading1 className="w-4 h-4" />} 
          label="Heading 1" 
          onClick={() => formatBlock("h1")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Heading2 className="w-4 h-4" />} 
          label="Heading 2" 
          onClick={() => formatBlock("h2")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Heading3 className="w-4 h-4" />} 
          label="Heading 3" 
          onClick={() => formatBlock("h3")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton 
          icon={<List className="w-4 h-4" />} 
          label="Bullet List" 
          onClick={() => execCommand("insertUnorderedList")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<ListOrdered className="w-4 h-4" />} 
          label="Numbered List" 
          onClick={() => execCommand("insertOrderedList")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<CheckSquare className="w-4 h-4" />} 
          label="Checklist" 
          onClick={() => execCommand("insertUnorderedList")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Quote className="w-4 h-4" />} 
          label="Quote" 
          onClick={() => formatBlock("blockquote")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton 
          icon={<AlignLeft className="w-4 h-4" />} 
          label="Align Left" 
          onClick={() => execCommand("justifyLeft")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<AlignCenter className="w-4 h-4" />} 
          label="Align Center" 
          onClick={() => execCommand("justifyCenter")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<AlignRight className="w-4 h-4" />} 
          label="Align Right" 
          onClick={() => execCommand("justifyRight")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Insert */}
        <ToolbarButton 
          icon={<Link className="w-4 h-4" />} 
          label="Insert Link" 
          onClick={insertLink}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Image className="w-4 h-4" />} 
          label="Insert Image" 
          onClick={insertImage}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Minus className="w-4 h-4" />} 
          label="Horizontal Rule" 
          onClick={() => execCommand("insertHorizontalRule")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Table className="w-4 h-4" />} 
          label="Insert Table" 
          onClick={() => {}}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton 
          icon={<Undo className="w-4 h-4" />} 
          label="Undo (Ctrl+Z)" 
          onClick={() => execCommand("undo")}
          disabled={readOnly}
        />
        <ToolbarButton 
          icon={<Redo className="w-4 h-4" />} 
          label="Redo (Ctrl+Y)" 
          onClick={() => execCommand("redo")}
          disabled={readOnly}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* AI Assist */}
        <Button variant="ghost" className="gap-2 text-[var(--accent-purple)]" disabled={readOnly}>
          <Sparkles className="w-4 h-4" />
          AI Assist
        </Button>
      </div>

      {/* Title */}
      <div className="px-8 pt-8">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
          disabled={readOnly}
          className="w-full text-4xl font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] bg-transparent border-none focus:outline-none"
        />
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleContentChange}
          onBlur={handleContentChange}
          className="min-h-[400px] prose prose-lg max-w-none text-[var(--text-primary)] focus:outline-none"
          style={{
            lineHeight: 1.8,
          }}
          dangerouslySetInnerHTML={{ __html: initialContent }}
          suppressContentEditableWarning
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-ground)] text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-4">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          ) : (
            <span>Not saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
