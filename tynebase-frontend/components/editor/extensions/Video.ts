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
      {
        tag: 'iframe[src]',
        getAttrs: node => {
          const src = (node as HTMLElement).getAttribute('src');
          // Match YouTube embed URLs
          if (src && (src.includes('youtube.com/embed') || src.includes('youtu.be'))) {
            return { src, videoType: 'youtube' };
          }
          return false;
        },
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    const { src, videoType } = HTMLAttributes;
    
    // YouTube embed
    if (videoType === 'youtube' || (src && (src.includes('youtube.com/embed') || src.includes('youtu.be')))) {
      const youtubeSrc = src?.includes('youtube.com/embed') ? src : 
        src?.includes('youtu.be') ? `https://www.youtube.com/embed/${src.split('/').pop()}` : src;
      
      return [
        'div',
        mergeAttributes(this.options.HTMLAttributes, { 
          'data-video': '',
          style: 'position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 0.5rem; margin: 1rem 0;'
        }),
        [
          'iframe',
          mergeAttributes({
            src: youtubeSrc,
            frameborder: '0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
            style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;'
          }),
        ],
      ];
    }
    
    // Regular video
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, { 'data-video': '' }),
      [
        'video',
        mergeAttributes(HTMLAttributes, {
          controls: true,
          preload: 'metadata',
          style: 'max-width: 100%; border-radius: 0.5rem; margin: 1rem 0;'
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
