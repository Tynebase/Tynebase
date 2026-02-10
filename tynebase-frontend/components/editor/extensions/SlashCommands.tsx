"use client";

import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import tippy, { Instance as TippyInstance } from "tippy.js";
import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Minus,
  Image as ImageIcon,
  Table as TableIcon,
  Type,
  AlertTriangle,
  Info,
  CheckCircle,
  Lightbulb,
} from "lucide-react";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
  category: string;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  // Text
  {
    title: "Text",
    description: "Just start writing with plain text",
    icon: <Type className="w-4 h-4" />,
    category: "Basic",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="w-4 h-4" />,
    category: "Basic",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="w-4 h-4" />,
    category: "Basic",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="w-4 h-4" />,
    category: "Basic",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  // Lists
  {
    title: "Bullet List",
    description: "Create a simple bullet list",
    icon: <List className="w-4 h-4" />,
    category: "Lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    icon: <ListOrdered className="w-4 h-4" />,
    category: "Lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Track tasks with a to-do list",
    icon: <CheckSquare className="w-4 h-4" />,
    category: "Lists",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  // Blocks
  {
    title: "Quote",
    description: "Add a blockquote",
    icon: <Quote className="w-4 h-4" />,
    category: "Blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Add a code snippet",
    icon: <Code2 className="w-4 h-4" />,
    category: "Blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Add a horizontal divider",
    icon: <Minus className="w-4 h-4" />,
    category: "Blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  // Media
  {
    title: "Table",
    description: "Insert a table",
    icon: <TableIcon className="w-4 h-4" />,
    category: "Media",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  // Callouts
  {
    title: "Info Callout",
    description: "Add an info callout box",
    icon: <Info className="w-4 h-4 text-blue-500" />,
    category: "Callouts",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "ℹ️ Info: " }] }],
        })
        .run();
    },
  },
  {
    title: "Warning Callout",
    description: "Add a warning callout box",
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    category: "Callouts",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "⚠️ Warning: " }] }],
        })
        .run();
    },
  },
  {
    title: "Success Callout",
    description: "Add a success callout box",
    icon: <CheckCircle className="w-4 h-4 text-green-500" />,
    category: "Callouts",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "✅ Success: " }] }],
        })
        .run();
    },
  },
  {
    title: "Tip Callout",
    description: "Add a tip callout box",
    icon: <Lightbulb className="w-4 h-4 text-purple-500" />,
    category: "Callouts",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "💡 Tip: " }] }],
        })
        .run();
    },
  },
];

interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-3 min-w-[280px]">
          <p className="text-sm text-[var(--text-tertiary)]">No commands found</p>
        </div>
      );
    }

    // Group items by category
    const categories = items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, SlashCommandItem[]>);

    let itemIndex = 0;

    return (
      <div ref={containerRef} className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden min-w-[280px] max-h-[320px] overflow-y-auto">
        {Object.entries(categories).map(([category, categoryItems]) => (
          <div key={category}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--surface-ground)]">
              {category}
            </div>
            {categoryItems.map((item) => {
              const currentIndex = itemIndex++;
              return (
                <button
                  key={item.title}
                  data-index={currentIndex}
                  onClick={() => selectItem(currentIndex)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    currentIndex === selectedIndex
                      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                      : "hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      currentIndex === selectedIndex
                        ? "bg-[var(--brand-primary)]/20"
                        : "bg-[var(--surface-ground)]"
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return SLASH_COMMANDS.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase()) ||
              item.category.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let component: ReactRenderer<CommandListRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate: (props: SuggestionProps) => {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }

              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
