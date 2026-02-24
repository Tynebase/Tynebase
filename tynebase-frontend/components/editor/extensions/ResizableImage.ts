import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageView } from './ResizableImageView';

export interface ResizableImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { 
        src: string; 
        alt?: string; 
        title?: string;
        width?: string | number;
        height?: string | number;
        alignment?: 'left' | 'center' | 'right';
      }) => ReturnType;
      setImageAlignment: (alignment: 'left' | 'center' | 'right') => ReturnType;
      setImageSize: (options: { width?: string | number; height?: string | number }) => ReturnType;
    };
  }
}

export const ResizableImage = Image.extend<ResizableImageOptions>({
  name: 'resizableImage',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: 'resizable-image',
      },
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width') || element.style.width;
          return width ? parseInt(width, 10) || null : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height') || element.style.height;
          return height ? parseInt(height, 10) || null : null;
        },
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      alignment: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-alignment') || 'left',
        renderHTML: attributes => {
          return { 'data-alignment': attributes.alignment || 'left' };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlignment:
        (alignment: 'left' | 'center' | 'right') =>
        ({ commands }) => {
          return commands.updateAttributes('resizableImage', { alignment });
        },
      setImageSize:
        (options: { width?: string | number; height?: string | number }) =>
        ({ commands }) => {
          return commands.updateAttributes('resizableImage', options);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      ArrowDown: ({ editor }) => {
        const { selection } = editor.state;
        const node = selection.$anchor.parent;
        
        // Check if we're at or near an image node
        if (selection.$anchor.nodeAfter?.type.name === 'resizableImage' ||
            selection.$anchor.nodeBefore?.type.name === 'resizableImage') {
          const pos = selection.$anchor.pos;
          const docSize = editor.state.doc.content.size;
          
          // Move to end of current position and insert paragraph if needed
          if (pos >= docSize - 2) {
            editor.chain().focus().insertContentAt(docSize, { type: 'paragraph' }).run();
          }
          
          // Move cursor forward
          editor.commands.setTextSelection(Math.min(pos + 1, docSize));
          return true;
        }
        return false;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
