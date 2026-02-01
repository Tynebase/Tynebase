import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import VideoNodeView from './VideoNodeView';

export interface VideoOptions {
  HTMLAttributes: Record<string, any>;
  allowFullscreen: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; title?: string; videoType?: 'youtube' | 'uploaded' }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: 'video',
  
  group: 'block',
  
  draggable: true,
  
  atom: true,
  
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'video-wrapper',
      },
      allowFullscreen: true,
    };
  },
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: null,
      },
      videoType: {
        default: null,
      },
      controls: {
        default: true,
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-video]',
      },
      {
        tag: 'video[src]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, { 'data-video': '' }),
      [
        'video',
        mergeAttributes(HTMLAttributes, {
          controls: true,
          preload: 'metadata',
        }),
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
  
  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export default Video;
