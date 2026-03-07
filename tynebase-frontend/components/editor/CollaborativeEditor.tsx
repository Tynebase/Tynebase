"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useState, useCallback } from "react";
import { EnhanceSuggestionsPanel } from "./EnhanceSuggestionsPanel";
import * as Y from "yjs";
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
  Minus,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckSquare,
  Sparkles,
  ChevronDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

interface CollaborativeEditorProps {
  documentId: string;
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
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

const COLLAB_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788",
  "#E76F51", "#2A9D8F", "#E9C46A", "#264653", "#F4A261",
];

const getColorForUser = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
};

export function CollaborativeEditor({
  documentId,
  initialTitle = "",
  onTitleChange,
  readOnly = false,
}: CollaborativeEditorProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [activeUsers, setActiveUsers] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showEnhancePanel, setShowEnhancePanel] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: provider?.document,
      }),
      CollaborationCursor.configure({
        provider: provider || undefined,
        user: {
          name: user?.full_name || user?.email?.split('@')[0] || "Anonymous",
          color: getColorForUser(user?.id || 'default'),
        },
      }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "min-h-[400px] prose prose-lg max-w-none text-[var(--text-primary)] focus:outline-none px-8 py-6",
        style: "line-height: 1.8",
      },
    },
    onCreate: ({ editor }) => {
      updateCounts(editor.getText());
    },
    onUpdate: ({ editor }) => {
      updateCounts(editor.getText());
    },
  }, [provider, readOnly]);

  const updateCounts = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    setCharCount(text.length);
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8081";
    const token = localStorage.getItem("access_token");

    if (!token) {
      console.error("[CollaborativeEditor] No access token found");
      setStatus("disconnected");
      return;
    }

    const ydoc = new Y.Doc();
    
    const hocuspocusProvider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      token,
      onStatus: ({ status }) => {
        console.log(`[CollaborativeEditor] Status: ${status}`);
        setStatus(status as "connecting" | "connected" | "disconnected");
      },
      onAwarenessUpdate: ({ states }) => {
        const users = Array.from(states.values())
          .filter((state: any) => state.user)
          .map((state: any) => state.user);
        setActiveUsers(users.length);
      },
      onConnect: () => {
        console.log(`[CollaborativeEditor] Connected to document ${documentId}`);
      },
      onDisconnect: () => {
        console.log(`[CollaborativeEditor] Disconnected from document ${documentId}`);
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error(`[CollaborativeEditor] Authentication failed: ${reason}`);
        setStatus("disconnected");
      },
    });

    setProvider(hocuspocusProvider);

    return () => {
      hocuspocusProvider.destroy();
    };
  }, [documentId]);

  // Update awareness with real user info when auth context loads
  useEffect(() => {
    if (provider && user) {
      const color = getColorForUser(user.id);
      const displayName = user.full_name || user.email?.split('@')[0] || 'Anonymous';
      provider.setAwarenessField('user', {
        name: displayName,
        color,
      });
    }
  }, [provider, user]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    onTitleChange?.(e.target.value);
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--text-secondary)]">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0">
      <div className="flex flex-col flex-1 bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
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
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Italic className="w-4 h-4" />}
          label="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Strikethrough className="w-4 h-4" />}
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Code className="w-4 h-4" />}
          label="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          icon={<Heading1 className="w-4 h-4" />}
          label="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Heading2 className="w-4 h-4" />}
          label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Heading3 className="w-4 h-4" />}
          label="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          label="Bullet List"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<ListOrdered className="w-4 h-4" />}
          label="Numbered List"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          disabled={readOnly}
        />
        <ToolbarButton
          icon={<Quote className="w-4 h-4" />}
          label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          disabled={readOnly}
        />

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          icon={<Undo className="w-4 h-4" />}
          label="Undo (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={readOnly || !editor.can().undo()}
        />
        <ToolbarButton
          icon={<Redo className="w-4 h-4" />}
          label="Redo (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={readOnly || !editor.can().redo()}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Collaboration Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            status === "connected" ? "bg-green-500" :
            status === "connecting" ? "bg-amber-500 animate-pulse" :
            "bg-red-500"
          }`} />
          <span className="text-[var(--text-tertiary)]">
            {status === "connected" ? "Connected" :
             status === "connecting" ? "Connecting..." :
             "Disconnected"}
          </span>
          {status === "connected" && activeUsers > 0 && (
            <>
              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
              <Users className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-tertiary)]">{activeUsers}</span>
            </>
          )}
        </div>

        {/* AI Enhance */}
        <Button 
          variant="ghost" 
          className="gap-2 text-[var(--accent-purple)]" 
          disabled={readOnly}
          onClick={() => setShowEnhancePanel(!showEnhancePanel)}
        >
          <Sparkles className="w-4 h-4" />
          {showEnhancePanel ? 'Hide Enhance' : 'AI Enhance'}
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
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-ground)] text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-4">
          {status === "connected" ? (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Auto-saving
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              {status === "connecting" ? "Connecting..." : "Offline"}
            </span>
          )}
        </div>
      </div>
      </div>

      {/* Enhance Panel */}
      {showEnhancePanel && (
        <EnhanceSuggestionsPanel
          documentId={documentId}
          onClose={() => setShowEnhancePanel(false)}
        />
      )}
    </div>
  );
}
