"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "./extensions/ResizableImage";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
import { Markdown } from "tiptap-markdown";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import { common, createLowlight } from "lowlight";
import { FontSize } from "./extensions/FontSize";
import { FontFamily } from "./extensions/FontFamily";
import { SlashCommands } from "./extensions/SlashCommands";
import { Video } from "./extensions/Video";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, List, ListOrdered,
  Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon,
  Table as TableIcon, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  CheckSquare, Sparkles, ChevronDown, Highlighter, Type, Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon, Youtube as YoutubeIcon, Code2, Maximize2, X, Plus,
  MoreHorizontal, Columns, RowsIcon, Trash2, History, Download, Clock, Palette,
  AlertTriangle, Info, CheckCircle, AlertCircle, Lightbulb, Flame, Minimize2,
  RotateCcw, RotateCw, Indent, Outdent, RemoveFormatting, PaintBucket
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EnhanceSuggestionsPanel } from "./EnhanceSuggestionsPanel";
import { uploadDocumentAsset } from "@/lib/api/documents";
import { Upload, Loader2, Eye, FileText, FileType, FileDown } from "lucide-react";
import { exportAsMarkdown, exportAsDocx, exportAsPdf, ExportFormat } from "@/lib/utils/documentExport";
import { useTenant } from "@/contexts/TenantContext";

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  documentId: string;
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
  onSave?: (data: { title: string; content: string }) => void;
  readOnly?: boolean;
  showVersionHistory?: boolean;
  onVersionHistoryToggle?: () => void;
}

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  // Sans-Serif
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Open Sans", value: "Open Sans, sans-serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Outfit", value: "Outfit, sans-serif" },
  { label: "DM Sans", value: "DM Sans, sans-serif" },
  { label: "Work Sans", value: "Work Sans, sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans, sans-serif" },
  { label: "Source Sans 3", value: "Source Sans 3, sans-serif" },
  { label: "Lexend", value: "Lexend, sans-serif" },
  { label: "Quicksand", value: "Quicksand, sans-serif" },
  { label: "Rubik", value: "Rubik, sans-serif" },
  { label: "Karla", value: "Karla, sans-serif" },
  { label: "Cabin", value: "Cabin, sans-serif" },
  { label: "Mulish", value: "Mulish, sans-serif" },
  { label: "Barlow", value: "Barlow, sans-serif" },
  { label: "Josefin Sans", value: "Josefin Sans, sans-serif" },
  { label: "Ubuntu", value: "Ubuntu, sans-serif" },
  { label: "Exo 2", value: "Exo 2, sans-serif" },
  { label: "Archivo", value: "Archivo, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  // Serif
  { label: "Playfair Display", value: "Playfair Display, serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "Crimson Text", value: "Crimson Text, serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville, serif" },
  { label: "EB Garamond", value: "EB Garamond, serif" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond, serif" },
  { label: "Bitter", value: "Bitter, serif" },
  { label: "Spectral", value: "Spectral, serif" },
  { label: "Noto Serif", value: "Noto Serif, serif" },
  { label: "PT Serif", value: "PT Serif, serif" },
  { label: "Vollkorn", value: "Vollkorn, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Palatino", value: "Palatino Linotype, Palatino, serif" },
  { label: "Book Antiqua", value: "Book Antiqua, serif" },
  // Display
  { label: "Bebas Neue", value: "Bebas Neue, sans-serif" },
  { label: "Anton", value: "Anton, sans-serif" },
  { label: "Oswald", value: "Oswald, sans-serif" },
  { label: "Righteous", value: "Righteous, cursive" },
  { label: "Fredoka", value: "Fredoka, sans-serif" },
  { label: "Pacifico", value: "Pacifico, cursive" },
  { label: "Lobster", value: "Lobster, cursive" },
  { label: "Dancing Script", value: "Dancing Script, cursive" },
  { label: "Caveat", value: "Caveat, cursive" },
  { label: "Satisfy", value: "Satisfy, cursive" },
  { label: "Great Vibes", value: "Great Vibes, cursive" },
  { label: "Permanent Marker", value: "Permanent Marker, cursive" },
  { label: "Bangers", value: "Bangers, cursive" },
  { label: "Comic Sans MS", value: "Comic Sans MS, cursive" },
  // Monospace
  { label: "Fira Code", value: "Fira Code, monospace" },
  { label: "JetBrains Mono", value: "JetBrains Mono, monospace" },
  { label: "Source Code Pro", value: "Source Code Pro, monospace" },
  { label: "IBM Plex Mono", value: "IBM Plex Mono, monospace" },
  { label: "Roboto Mono", value: "Roboto Mono, monospace" },
  { label: "Space Mono", value: "Space Mono, monospace" },
  { label: "Inconsolata", value: "Inconsolata, monospace" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
];

const FONT_SIZES = [
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "22", value: "22px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "32", value: "32px" },
  { label: "36", value: "36px" },
  { label: "42", value: "42px" },
  { label: "48", value: "48px" },
  { label: "56", value: "56px" },
  { label: "64", value: "64px" },
  { label: "72", value: "72px" },
  { label: "96", value: "96px" },
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#CCCCCC", "#D9D9D9", "#EFEFEF", "#F3F3F3", "#FFFFFF",
  "#980000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#00FFFF", "#4A86E8", "#0000FF", "#9900FF", "#FF00FF",
  "#E6B8AF", "#F4CCCC", "#FCE5CD", "#FFF2CC", "#D9EAD3", "#D0E0E3", "#C9DAF8", "#CFE2F3", "#D9D2E9", "#EAD1DC",
  "#DD7E6B", "#EA9999", "#F9CB9C", "#FFE599", "#B6D7A8", "#A2C4C9", "#A4C2F4", "#9FC5E8", "#B4A7D6", "#D5A6BD",
  "#CC4125", "#E06666", "#F6B26B", "#FFD966", "#93C47D", "#76A5AF", "#6D9EEB", "#6FA8DC", "#8E7CC3", "#C27BA0",
  "#A61C00", "#CC0000", "#E69138", "#F1C232", "#6AA84F", "#45818E", "#3C78D8", "#3D85C6", "#674EA7", "#A64D79",
  "#85200C", "#990000", "#B45F06", "#BF9000", "#38761D", "#134F5C", "#1155CC", "#0B5394", "#351C75", "#741B47",
  "#5B0F00", "#660000", "#783F04", "#7F6000", "#274E13", "#0C343D", "#1C4587", "#073763", "#20124D", "#4C1130",
];

const HIGHLIGHT_COLORS = [
  "", "#FFFF00", "#00FF00", "#00FFFF", "#FF00FF", "#0000FF", "#FF0000", "#000080", "#008080", "#00FF00",
  "#800080", "#800000", "#808000", "#808080", "#C0C0C0",
];

const getRandomColor = () => {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function RichTextEditor({
  documentId,
  initialTitle = "",
  onTitleChange,
  onSave,
  readOnly = false,
  showVersionHistory = false,
  onVersionHistoryToggle,
}: RichTextEditorProps) {
  const { tenant } = useTenant();
  const [title, setTitle] = useState(initialTitle);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  
  // Sync internal title state when initialTitle prop changes (e.g., when document is loaded)
  useEffect(() => {
    if (initialTitle && initialTitle !== title) {
      setTitle(initialTitle);
    }
  }, [initialTitle]);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [activeUsers, setActiveUsers] = useState<{ name: string; color: string }[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showEnhancePanel, setShowEnhancePanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Restore enhancement panel state from sessionStorage on mount
  useEffect(() => {
    const storageKey = `enhance-${documentId}`;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // If there's persisted enhancement data, reopen the panel
        if (data.score !== undefined || (data.suggestions && data.suggestions.length > 0)) {
          setShowEnhancePanel(true);
        }
      }
    } catch (err) {
      console.error('[RichTextEditor] Failed to restore enhancement panel state:', err);
    }
  }, [documentId]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [activeColorPicker, setActiveColorPicker] = useState<"text" | "highlight" | null>(null);
  const [titleAlign, setTitleAlign] = useState<"left" | "center" | "right">("left");
  const [pageMargin, setPageMargin] = useState<"narrow" | "normal" | "wide">("normal");
  const [imageInputMode, setImageInputMode] = useState<"url" | "file">("url");
  const [videoInputMode, setVideoInputMode] = useState<"url" | "file">("url");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const userColorRef = useRef(getRandomColor());
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const editorRefForDrag = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCounts = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    setCharCount(text.length);
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragging(false);
        return 0;
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setIsDragging(false);

    if (readOnly) return;

    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;

    // Get editor instance from ref - updated via useEffect after editor is created
    const editorInstance = editorRefForDrag.current;
    if (!editorInstance || readOnly) return;

    // Handle dropped files (images, documents)
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];

        if (file.type.startsWith('image/')) {
          // Handle image upload
          try {
            const response = await uploadDocumentAsset(documentId, file);
            editorInstance.chain().focus().setImage({ src: response.signed_url }).run();
          } catch (err) {
            console.error('Failed to upload image:', err);
          }
        } else if (file.type.startsWith('video/')) {
          // Handle video upload
          try {
            const response = await uploadDocumentAsset(documentId, file);
            editorInstance.chain().focus().setVideo({
              src: response.signed_url,
              title: response.filename,
              videoType: 'uploaded' as const
            }).run();
          } catch (err) {
            console.error('Failed to upload video:', err);
          }
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          // Handle text files - read and insert content
          try {
            const text = await file.text();
            editorInstance.chain().focus().insertContent(text).run();
          } catch (err) {
            console.error('Failed to read text file:', err);
          }
        } else {
          // Handle other files as attachments (insert as link)
          try {
            const response = await uploadDocumentAsset(documentId, file);
            editorInstance.chain().focus()
              .insertContent(`<a href="${response.signed_url}" target="_blank" rel="noopener noreferrer">${response.filename || file.name}</a>`)
              .run();
          } catch (err) {
            console.error('Failed to upload file:', err);
          }
        }
      }
      return;
    }

    // Handle HTML content (rich text from other sources)
    const html = dataTransfer.getData('text/html');
    if (html) {
      editorInstance.chain().focus().insertContent(html).run();
      return;
    }

    // Handle plain text
    const text = dataTransfer.getData('text/plain');
    if (text) {
      editorInstance.chain().focus().insertContent(text).run();
      return;
    }

    // Handle URLs (dragged links)
    const url = dataTransfer.getData('text/uri-list') || dataTransfer.getData('URL');
    if (url && url.startsWith('http')) {
      // Check if it's an image URL
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        editorInstance.chain().focus().setImage({ src: url }).run();
      } else {
        // Insert as link
        editorInstance.chain().focus()
          .insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
          .run();
      }
    }
  }, [documentId, readOnly]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8081";
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (!token) {
      console.error("[RichTextEditor] No access token found");
      setStatus("disconnected");
      return;
    }

    const doc = new Y.Doc();
    const hocuspocusProvider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: doc,
      token,
      onStatus: ({ status }) => setStatus(status as "connecting" | "connected" | "disconnected"),
      onSynced: ({ state }) => {
        console.log(`[RichTextEditor] Document ${documentId} synced with server, state:`, state);
        // Get the XML fragment to check if content was loaded
        const fragment = doc.getXmlFragment('default');
        console.log(`[RichTextEditor] Y.js fragment length: ${fragment.length}, content preview:`, fragment.toString().substring(0, 100));
        setIsReady(true);
      },
      onAwarenessUpdate: ({ states }) => {
        const users = Array.from(states.values())
          .filter((state: any) => state.user)
          .map((state: any) => ({ name: state.user.name || "Anonymous", color: state.user.color || "#888" }));
        setActiveUsers(users);
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error(`[RichTextEditor] Auth failed: ${reason}`);
        setStatus("disconnected");
      },
    });

    setYdoc(doc);
    setProvider(hocuspocusProvider);

    // Ensure clean disconnect on page unload to trigger server-side save
    const handleBeforeUnload = () => {
      hocuspocusProvider.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      hocuspocusProvider.destroy();
      doc.destroy();
    };
  }, [documentId]);

  const extensions = [
    StarterKit.configure({ history: false, codeBlock: false }),
    ...(ydoc ? [Collaboration.configure({ 
      document: ydoc,
      field: 'default'
    })] : []),
    ...(provider ? [CollaborationCursor.configure({
      provider,
      user: {
        name: typeof window !== "undefined" ? localStorage.getItem("user_email") || "Anonymous" : "Anonymous",
        color: userColorRef.current,
      },
    })] : []),
    Underline,
    Link.configure({ openOnClick: false }),
    ResizableImage.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-lg my-4" } }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({ placeholder: "Start writing your document..." }),
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
    SlashCommands,
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[500px] px-8 py-6",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || readOnly) return false;
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer?.files?.length) return false;
        const hasMedia = Array.from(dataTransfer.files).some(
          (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
        );
        if (!hasMedia) return false;
        event.preventDefault();
        (async () => {
          for (const file of Array.from(dataTransfer.files)) {
            try {
              if (file.type.startsWith('image/')) {
                const response = await uploadDocumentAsset(documentId, file);
                view.dispatch(view.state.tr);
                editorRefForDrag.current?.chain().focus().setImage({ src: response.signed_url }).run();
              } else if (file.type.startsWith('video/')) {
                const response = await uploadDocumentAsset(documentId, file);
                view.dispatch(view.state.tr);
                editorRefForDrag.current?.chain().focus().setVideo({
                  src: response.signed_url,
                  title: response.filename,
                  videoType: 'uploaded' as const,
                }).run();
              }
            } catch (err) {
              console.error('Failed to upload dropped file:', err);
            }
          }
        })();
        return true;
      },
      handlePaste: (view, event) => {
        if (readOnly) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        (async () => {
          try {
            const response = await uploadDocumentAsset(documentId, file);
            editorRefForDrag.current?.chain().focus().setImage({ src: response.signed_url }).run();
          } catch (err) {
            console.error('Failed to upload pasted image:', err);
          }
        })();
        return true;
      },
    },
    onCreate: ({ editor }) => updateCounts(editor.getText()),
    onUpdate: ({ editor }) => updateCounts(editor.getText()),
  }, [isReady]);

  // Keep editor ref updated for drag-drop handlers
  useEffect(() => {
    editorRefForDrag.current = editor;
  }, [editor]);

  // Update editable state when readOnly changes without recreating the editor
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Set up drag and drop event listeners on the editor container
  useEffect(() => {
    if (!editorContainerRef.current || readOnly) return;

    const container = editorContainerRef.current;
    container.addEventListener('dragenter', handleDragEnter as unknown as EventListener);
    container.addEventListener('dragleave', handleDragLeave as unknown as EventListener);
    container.addEventListener('dragover', handleDragOver as unknown as EventListener);
    container.addEventListener('drop', handleDrop as unknown as EventListener);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter as unknown as EventListener);
      container.removeEventListener('dragleave', handleDragLeave as unknown as EventListener);
      container.removeEventListener('dragover', handleDragOver as unknown as EventListener);
      container.removeEventListener('drop', handleDrop as unknown as EventListener);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop, readOnly]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    onTitleChange?.(e.target.value);
  };

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
    setShowImageInput(false);
  }, [editor, imageUrl]);

  const addYoutube = useCallback(() => {
    if (!editor || !youtubeUrl) return;
    // Use custom Video node instead of YouTube extension for RAG support
    editor.chain().focus().setVideo({ 
      src: youtubeUrl, 
      videoType: 'youtube' as const 
    }).run();
    setYoutubeUrl("");
    setShowYoutubeInput(false);
  }, [editor, youtubeUrl]);

  const handleImageFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const response = await uploadDocumentAsset(documentId, file);
      editor.chain().focus().setImage({ src: response.signed_url }).run();
      setShowImageInput(false);
      setImageInputMode("url");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  }, [editor, documentId]);

  const handleVideoFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const response = await uploadDocumentAsset(documentId, file);
      // Use the Video extension to insert the video properly
      editor.chain().focus().setVideo({ 
        src: response.signed_url, 
        title: response.filename,
        videoType: 'uploaded' as const
      }).run();
      setShowYoutubeInput(false);
      setVideoInputMode("url");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setIsUploading(false);
      if (videoFileRef.current) videoFileRef.current.value = "";
    }
  }, [editor, documentId]);

  const getCurrentFontSize = () => {
    if (!editor) return "16px";
    return editor.getAttributes("textStyle").fontSize || "16px";
  };

  const getCurrentFontFamily = () => {
    if (!editor) return "";
    return editor.getAttributes("textStyle").fontFamily || "";
  };

  const getCurrentTextColor = () => {
    if (!editor) return "#000000";
    return editor.getAttributes("textStyle").color || "#000000";
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--dash-text-secondary)]">Loading editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={editorContainerRef}
      className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50 bg-[var(--surface-ground)]" : ""}`}
    >
      {/* Ribbon Toolbar - Hidden in preview mode */}
      {!readOnly && <div className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-[var(--border-subtle)] gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Untitled Document"
              disabled={readOnly}
              className="text-base sm:text-xl font-semibold text-[var(--text-primary)] bg-transparent border-none focus:outline-none focus:bg-[var(--surface-ground)] focus:ring-2 focus:ring-[var(--brand-primary)] rounded px-2 py-1 flex-1 min-w-0"
              style={{ textAlign: titleAlign }}
            />
            {/* Title Alignment - hidden on mobile */}
            <div className="hidden sm:flex items-center gap-0.5 border-l border-[var(--border-subtle)] pl-2 ml-2 flex-shrink-0">
              <button
                onClick={() => setTitleAlign("left")}
                className={`p-1.5 rounded ${titleAlign === "left" ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                title="Align Title Left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTitleAlign("center")}
                className={`p-1.5 rounded ${titleAlign === "center" ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                title="Align Title Center"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTitleAlign("right")}
                className={`p-1.5 rounded ${titleAlign === "right" ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                title="Align Title Right"
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Collaborator Avatars */}
            {activeUsers.length > 0 && (
              <div className="flex items-center -space-x-2 mr-2">
                {activeUsers.slice(0, 4).map((user, idx) => (
                  <div
                    key={`${user.name}-${idx}`}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: user.color, zIndex: 10 - idx }}
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 4 && (
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white bg-slate-500 flex items-center justify-center text-xs font-semibold text-white shadow-sm"
                    style={{ zIndex: 5 }}
                    title={`${activeUsers.length - 4} more`}
                  >
                    +{activeUsers.length - 4}
                  </div>
                )}
              </div>
            )}
            {/* Collaboration Status */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-[var(--surface-ground)] rounded-full border border-[var(--border-subtle)]">
              <div className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-amber-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">{status === "connected" ? `${activeUsers.length} online` : status}</span>
            </div>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 sm:p-2 hover:bg-[var(--surface-hover)] rounded text-[var(--text-secondary)]" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main Toolbar */}
        <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-1 sm:py-1.5 flex-wrap overflow-x-auto">
          {/* Font Family - hidden on small screens */}
          <select
            value={getCurrentFontFamily()}
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setFontFamily(e.target.value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
            className="hidden md:block h-7 sm:h-8 px-1 sm:px-2 text-xs sm:text-sm bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-w-[100px] lg:min-w-[120px]"
            disabled={readOnly}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                {font.label}
              </option>
            ))}
          </select>

          {/* Font Size */}
          <select
            value={getCurrentFontSize()}
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
            className="hidden sm:block h-7 sm:h-8 px-1 sm:px-2 text-xs sm:text-sm bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] w-[60px] sm:w-[70px]"
            disabled={readOnly}
          >
            {FONT_SIZES.map((size) => (
              <option key={size.value} value={size.value}>{size.label}</option>
            ))}
          </select>

          <div className="hidden sm:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Text Formatting */}
          <ToolbarBtn icon={<Bold className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} disabled={readOnly} title="Bold (Ctrl+B)" />
          <ToolbarBtn icon={<Italic className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} disabled={readOnly} title="Italic (Ctrl+I)" />
          <ToolbarBtn icon={<UnderlineIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} disabled={readOnly} title="Underline (Ctrl+U)" />
          <ToolbarBtn icon={<Strikethrough className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} disabled={readOnly} title="Strikethrough" />
          <span className="hidden lg:inline"><ToolbarBtn icon={<SubscriptIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} disabled={readOnly} title="Subscript" /></span>
          <span className="hidden lg:inline"><ToolbarBtn icon={<SuperscriptIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} disabled={readOnly} title="Superscript" /></span>

          <div className="hidden sm:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Text Color */}
          <div className="relative" ref={activeColorPicker === "text" ? colorPickerRef : null}>
            <button
              onClick={() => setActiveColorPicker(activeColorPicker === "text" ? null : "text")}
              className="flex items-center h-8 px-1 hover:bg-[var(--surface-hover)] rounded text-[var(--text-primary)]"
              disabled={readOnly}
              title="Text Color"
            >
              <div className="flex flex-col items-center">
                <Type className="w-4 h-4" />
                <div className="w-4 h-1 mt-0.5 rounded-sm" style={{ backgroundColor: getCurrentTextColor() }} />
              </div>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
            {activeColorPicker === "text" && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50">
                <div className="grid grid-cols-10 gap-0.5" style={{ width: "200px" }}>
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run();
                        setActiveColorPicker(null);
                      }}
                      className="w-[18px] h-[18px] rounded-sm border border-[var(--border-subtle)] hover:scale-125 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div className="relative" ref={activeColorPicker === "highlight" ? colorPickerRef : null}>
            <button
              onClick={() => setActiveColorPicker(activeColorPicker === "highlight" ? null : "highlight")}
              className="flex items-center h-8 px-1 hover:bg-[var(--surface-hover)] rounded text-[var(--text-primary)]"
              disabled={readOnly}
              title="Highlight Color"
            >
              <div className="flex flex-col items-center">
                <Highlighter className="w-4 h-4" />
                <div className="w-4 h-1 mt-0.5 rounded-sm bg-yellow-300" />
              </div>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
            {activeColorPicker === "highlight" && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50">
                <div className="grid grid-cols-5 gap-1" style={{ width: "120px" }}>
                  <button
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run();
                      setActiveColorPicker(null);
                    }}
                    className="w-[20px] h-[20px] rounded border border-[var(--border-subtle)] hover:scale-110 transition-transform flex items-center justify-center bg-[var(--surface-ground)]"
                    title="No highlight"
                  >
                    <X className="w-3 h-3 text-[var(--text-tertiary)]" />
                  </button>
                  {HIGHLIGHT_COLORS.filter(c => c).map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        editor.chain().focus().toggleHighlight({ color }).run();
                        setActiveColorPicker(null);
                      }}
                      className="w-[20px] h-[20px] rounded border border-[var(--border-subtle)] hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Headings */}
          <select
            value={
              editor.isActive("heading", { level: 1 }) ? "1" :
              editor.isActive("heading", { level: 2 }) ? "2" :
              editor.isActive("heading", { level: 3 }) ? "3" : "p"
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: parseInt(val) as 1 | 2 | 3 }).run();
            }}
            className="h-7 sm:h-8 px-1 sm:px-2 text-xs sm:text-sm bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-default)] focus:outline-none w-[80px] sm:w-[100px]"
            disabled={readOnly}
          >
            <option value="p">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <div className="w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Lists */}
          <ToolbarBtn icon={<List className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} disabled={readOnly} title="Bullet List" />
          <ToolbarBtn icon={<ListOrdered className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} disabled={readOnly} title="Numbered List" />
          <ToolbarBtn icon={<CheckSquare className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} disabled={readOnly} title="Checklist" />

          <div className="hidden sm:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Alignment - hidden on mobile */}
          <span className="hidden sm:inline"><ToolbarBtn icon={<AlignLeft className="w-4 h-4" />} onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} disabled={readOnly} title="Align Left" /></span>
          <span className="hidden sm:inline"><ToolbarBtn icon={<AlignCenter className="w-4 h-4" />} onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} disabled={readOnly} title="Align Center" /></span>
          <span className="hidden sm:inline"><ToolbarBtn icon={<AlignRight className="w-4 h-4" />} onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} disabled={readOnly} title="Align Right" /></span>
          <span className="hidden lg:inline"><ToolbarBtn icon={<AlignJustify className="w-4 h-4" />} onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} disabled={readOnly} title="Justify" /></span>

          <div className="hidden sm:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Insert */}
          <ToolbarBtn icon={<LinkIcon className="w-4 h-4" />} onClick={() => setShowLinkInput(!showLinkInput)} active={editor.isActive("link")} disabled={readOnly} title="Insert Link" />
          <ToolbarBtn icon={<ImageIcon className="w-4 h-4" />} onClick={() => setShowImageInput(true)} disabled={readOnly} title="Insert Image" />
          <ToolbarBtn icon={<TableIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={readOnly} title="Insert Table" />
          <ToolbarBtn icon={<YoutubeIcon className="w-4 h-4" />} onClick={() => setShowYoutubeInput(true)} disabled={readOnly} title="Insert YouTube" />
          <span className="hidden sm:inline"><ToolbarBtn icon={<Quote className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} disabled={readOnly} title="Quote" /></span>
          <span className="hidden sm:inline"><ToolbarBtn icon={<Code2 className="w-4 h-4" />} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} disabled={readOnly} title="Code Block" /></span>
          <span className="hidden lg:inline"><ToolbarBtn icon={<Minus className="w-4 h-4" />} onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={readOnly} title="Horizontal Line" /></span>

          <div className="hidden lg:block w-px h-6 bg-[var(--border-subtle)] mx-0.5 sm:mx-1" />

          {/* Page Margins - hidden on mobile */}
          <select
            value={pageMargin}
            onChange={(e) => setPageMargin(e.target.value as "narrow" | "normal" | "wide")}
            className="hidden lg:block h-7 sm:h-8 px-1 sm:px-2 text-xs sm:text-sm bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-default)] focus:outline-none w-[80px] sm:w-[90px]"
            title="Page Margins"
          >
            <option value="narrow">Narrow</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>

          <div className="flex-1" />

          {/* Right side actions */}
          <ToolbarBtn icon={<History className="w-4 h-4" />} onClick={onVersionHistoryToggle || (() => {})} title="Version History" />
          
          {/* Export Button - Only show if enabled in tenant settings */}
          {tenant?.settings?.features?.document_export_enabled !== false && (
            <ToolbarBtn 
              icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
              onClick={() => setShowExportModal(true)} 
              title="Export Document" 
              disabled={isExporting}
            />
          )}
          
          {/* MD/RAW Toggle */}
          <Button 
            variant="ghost" 
            className={`gap-1 px-1.5 sm:px-2 ${showRawMarkdown ? "text-amber-500 hover:text-amber-400 bg-amber-500/10" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"} hover:bg-[var(--surface-hover)]`}
            onClick={() => setShowRawMarkdown(!showRawMarkdown)}
            title={showRawMarkdown ? "Show formatted markdown" : "Show raw markdown"}
          >
            <Code2 className="w-4 h-4" />
            <span className="text-xs sm:text-sm hidden xs:inline">{showRawMarkdown ? "RAW" : "MD"}</span>
          </Button>
          
          <Button variant="ghost" className="gap-1 px-1.5 sm:px-2 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10" disabled={readOnly} onClick={() => setShowEnhancePanel(!showEnhancePanel)}>
            <Sparkles className="w-4 h-4" />
            <span className="text-xs sm:text-sm hidden xs:inline">AI</span>
          </Button>
        </div>

        {/* Table toolbar - shows when in table */}
        {editor.isActive("table") && (
          <div className="flex items-center gap-1 px-2 py-1 bg-[var(--brand-primary)]/10 border-t border-[var(--brand-primary)]/20">
            <span className="text-xs font-medium text-[var(--brand-primary)] mr-2">Table:</span>
            <ToolbarBtn icon={<Columns className="w-4 h-4" />} onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before" small />
            <ToolbarBtn icon={<Columns className="w-4 h-4" />} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After" small />
            <ToolbarBtn icon={<RowsIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before" small />
            <ToolbarBtn icon={<RowsIcon className="w-4 h-4" />} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After" small />
            <div className="w-px h-4 bg-[var(--brand-primary)]/30 mx-1" />
            <ToolbarBtn icon={<Trash2 className="w-4 h-4" />} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column" small danger />
            <ToolbarBtn icon={<Trash2 className="w-4 h-4" />} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row" small danger />
            <ToolbarBtn icon={<Trash2 className="w-4 h-4" />} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table" small danger />
          </div>
        )}

        {/* Link input bar */}
        {showLinkInput && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)]/10 border-t border-[var(--brand-primary)]/20">
            <span className="text-sm text-[var(--brand-primary)]">Link URL:</span>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 max-w-md px-3 py-1.5 text-sm bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              onKeyDown={(e) => { if (e.key === "Enter") setLink(); if (e.key === "Escape") setShowLinkInput(false); }}
              autoFocus
            />
            <button onClick={setLink} className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--brand-primary)] rounded hover:bg-[var(--brand-primary-hover)]">Apply</button>
            {editor.isActive("link") && (
              <button onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false); }} className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded">Remove</button>
            )}
            <button onClick={() => setShowLinkInput(false)} className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] rounded"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>}

      {/* Preview Mode Header */}
      {readOnly && (
        <div className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <h1 
              className="text-2xl font-bold text-gray-900"
              style={{ textAlign: titleAlign }}
            >
              {title || "Untitled Document"}
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full">
              <Eye className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-500">Preview Mode</span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showImageInput && (
        <Modal title="Insert Image" onClose={() => { setShowImageInput(false); setUploadError(null); setImageInputMode("url"); }}>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setImageInputMode("url")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                imageInputMode === "url" 
                  ? "bg-[var(--brand-primary)] text-white" 
                  : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <LinkIcon className="w-4 h-4 inline mr-2" />
              From URL
            </button>
            <button
              onClick={() => setImageInputMode("file")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                imageInputMode === "file" 
                  ? "bg-[var(--brand-primary)] text-white" 
                  : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload File
            </button>
          </div>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
              {uploadError}
            </div>
          )}

          {imageInputMode === "url" ? (
            <>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full px-4 py-2 bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" autoFocus />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowImageInput(false); setUploadError(null); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">Cancel</button>
                <button onClick={addImage} className="px-4 py-2 text-white bg-[var(--brand-primary)] rounded-lg hover:bg-[var(--brand-primary-hover)]">Insert</button>
              </div>
            </>
          ) : (
            <>
              <div 
                onClick={() => imageFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    const input = imageFileRef.current;
                    if (input) {
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      input.files = dataTransfer.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                }}
                className="border-2 border-dashed border-[var(--border-subtle)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-[var(--brand-primary)] animate-spin" />
                    <span className="text-sm text-[var(--text-secondary)]">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[var(--text-tertiary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Click or drag & drop an image</span>
                    <span className="text-xs text-[var(--text-tertiary)]">JPG, PNG, GIF, WebP, SVG (max 10MB)</span>
                  </div>
                )}
              </div>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleImageFileUpload}
                className="hidden"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowImageInput(false); setUploadError(null); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">Cancel</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {showYoutubeInput && (
        <Modal title="Insert Video" onClose={() => { setShowYoutubeInput(false); setUploadError(null); setVideoInputMode("url"); }}>
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setVideoInputMode("url")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                videoInputMode === "url" 
                  ? "bg-[var(--brand-primary)] text-white" 
                  : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <YoutubeIcon className="w-4 h-4 inline mr-2" />
              YouTube URL
            </button>
            <button
              onClick={() => setVideoInputMode("file")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                videoInputMode === "file" 
                  ? "bg-[var(--brand-primary)] text-white" 
                  : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload File
            </button>
          </div>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
              {uploadError}
            </div>
          )}

          {videoInputMode === "url" ? (
            <>
              <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full px-4 py-2 bg-[var(--surface-ground)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" autoFocus />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowYoutubeInput(false); setUploadError(null); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">Cancel</button>
                <button onClick={addYoutube} className="px-4 py-2 text-white bg-[var(--brand-primary)] rounded-lg hover:bg-[var(--brand-primary-hover)]">Embed</button>
              </div>
            </>
          ) : (
            <>
              <div 
                onClick={() => videoFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('video/')) {
                    const input = videoFileRef.current;
                    if (input) {
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      input.files = dataTransfer.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                }}
                className="border-2 border-dashed border-[var(--border-subtle)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-[var(--brand-primary)] animate-spin" />
                    <span className="text-sm text-[var(--text-secondary)]">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[var(--text-tertiary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Click or drag & drop a video</span>
                    <span className="text-xs text-[var(--text-tertiary)]">MP4, MOV, WebM (max 50MB)</span>
                  </div>
                )}
              </div>
              <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleVideoFileUpload}
                className="hidden"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowYoutubeInput(false); setUploadError(null); }} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg">Cancel</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <Modal title="Export Document" onClose={() => setShowExportModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Choose a format to download your document
            </p>
            
            <button
              onClick={async () => {
                setShowExportModal(false);
                if (editor) exportAsMarkdown(editor, title);
              }}
              disabled={isExporting}
              className="w-full flex items-center gap-4 p-4 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg transition-colors group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-[var(--surface-card)] rounded-lg border border-[var(--border-subtle)] group-hover:border-[var(--brand-primary)] transition-colors">
                <FileText className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)]" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-[var(--text-primary)]">Markdown</div>
                <div className="text-xs text-[var(--text-tertiary)]">Plain text with formatting (.md)</div>
              </div>
            </button>

            <button
              onClick={async () => {
                setShowExportModal(false);
                setIsExporting(true);
                try {
                  if (editor) await exportAsDocx(editor, title);
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="w-full flex items-center gap-4 p-4 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg transition-colors group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-[var(--surface-card)] rounded-lg border border-[var(--border-subtle)] group-hover:border-blue-500 transition-colors">
                <FileType className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-[var(--text-primary)]">Word Document</div>
                <div className="text-xs text-[var(--text-tertiary)]">Microsoft Word format (.docx)</div>
              </div>
            </button>

            <button
              onClick={async () => {
                setShowExportModal(false);
                setIsExporting(true);
                try {
                  if (editor) await exportAsPdf(editor, title);
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="w-full flex items-center gap-4 p-4 bg-[var(--surface-ground)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg transition-colors group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-[var(--surface-card)] rounded-lg border border-[var(--border-subtle)] group-hover:border-red-500 transition-colors">
                <FileDown className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-[var(--text-primary)]">PDF Document</div>
                <div className="text-xs text-[var(--text-tertiary)]">Portable document format (.pdf)</div>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* Editor Content + AI Panel Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Editor Content */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-[var(--surface-ground)] p-4 relative">
          {/* Drag and Drop Overlay */}
          {isDragging && !readOnly && (
            <div className="absolute inset-0 z-50 bg-[var(--brand-primary)]/10 border-2 border-dashed border-[var(--brand-primary)] rounded-lg m-4 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 bg-[var(--brand-primary)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-8 h-8 text-[var(--brand-primary)]" />
                </div>
                <p className="text-lg font-medium text-[var(--brand-primary)]">Drop to insert</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Images, videos, text, or files</p>
              </div>
            </div>
          )}
          <div 
            className={`mx-auto bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-sm min-h-full ${
              pageMargin === "wide" ? "max-w-none" : pageMargin === "narrow" ? "max-w-3xl" : "max-w-5xl"
            }`}
          >
            {showRawMarkdown ? (
              <div className="raw-markdown px-8 py-6">
                <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--text-primary)] bg-[var(--surface-ground)] p-4 rounded-lg overflow-x-auto">
                  {editor?.getText() || ''}
                </pre>
              </div>
            ) : (
              <EditorContent editor={editor} className="editor-content" />
            )}
          </div>
        </div>

        {/* AI Panel - Sidebar */}
        {showEnhancePanel && (
          <EnhanceSuggestionsPanel 
            documentId={documentId} 
            onClose={() => setShowEnhancePanel(false)}
            editor={editor}
          />
        )}
      </div>


      {/* Image Bubble Menu - Hidden in preview mode */}
      {editor && !readOnly && (
        <BubbleMenu 
          editor={editor} 
          tippyOptions={{ duration: 100 }} 
          className="flex items-center gap-1 p-1.5 bg-gray-900 rounded-lg shadow-xl"
          shouldShow={({ editor }) => editor.isActive('resizableImage')}
        >
          <span className="text-xs text-gray-400 px-2">Align:</span>
          <BubbleBtn 
            icon={<AlignLeft className="w-3.5 h-3.5" />} 
            onClick={() => editor.chain().focus().updateAttributes('resizableImage', { alignment: 'left' }).run()} 
            active={editor.getAttributes('resizableImage').alignment === 'left'}
            title="Align Left"
          />
          <BubbleBtn 
            icon={<AlignCenter className="w-3.5 h-3.5" />} 
            onClick={() => editor.chain().focus().updateAttributes('resizableImage', { alignment: 'center' }).run()} 
            active={editor.getAttributes('resizableImage').alignment === 'center' || !editor.getAttributes('resizableImage').alignment}
            title="Align Center"
          />
          <BubbleBtn 
            icon={<AlignRight className="w-3.5 h-3.5" />} 
            onClick={() => editor.chain().focus().updateAttributes('resizableImage', { alignment: 'right' }).run()} 
            active={editor.getAttributes('resizableImage').alignment === 'right'}
            title="Align Right"
          />
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <BubbleBtn 
            icon={<Trash2 className="w-3.5 h-3.5" />} 
            onClick={() => editor.chain().focus().deleteSelection().run()} 
            title="Delete Image"
          />
        </BubbleMenu>
      )}

      {/* Status Bar - Hidden in preview mode */}
      {!readOnly && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--surface-card)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Auto-saved
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ icon, onClick, active, disabled, title, small, danger }: {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  small?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${small ? "p-1" : "p-1.5"} rounded transition-colors ${
        active ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]" : danger ? "text-red-500 hover:bg-red-500/10" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {icon}
    </button>
  );
}

function BubbleBtn({ icon, onClick, active, title }: { icon: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded ${active ? "bg-white/20 text-white" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
      {icon}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--surface-card)] p-6 rounded-xl shadow-xl max-w-md w-full mx-4 border border-[var(--border-subtle)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
