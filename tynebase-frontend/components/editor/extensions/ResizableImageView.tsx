"use client";

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function ResizableImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [initialWidth, setInitialWidth] = useState(0);
  const [initialHeight, setInitialHeight] = useState(0);
  const [initialX, setInitialX] = useState(0);
  const [initialY, setInitialY] = useState(0);
  const [resizeDirection, setResizeDirection] = useState<string>('');

  const { src, alt, title, width, height, alignment } = node.attrs;

  // Move cursor after the image (to the next line/paragraph)
  const moveCursorAfterImage = useCallback(() => {
    if (!editor || typeof getPos !== 'function') return;
    
    const pos = getPos();
    const nodeSize = node.nodeSize;
    const endPos = pos + nodeSize;
    const docSize = editor.state.doc.content.size;
    
    if (endPos >= docSize - 1) {
      // Image is at the end of the document - insert a paragraph and move cursor into it
      editor.chain()
        .focus()
        .insertContentAt(endPos, { type: 'paragraph' })
        .setTextSelection(endPos + 1)
        .run();
    } else {
      // There's content after the image - move cursor there
      editor.chain().focus().setTextSelection(endPos).run();
    }
  }, [editor, getPos, node.nodeSize]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      moveCursorAfterImage();
    }
  }, [moveCursorAfterImage]);

  const startResize = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const img = containerRef.current?.querySelector('img');
    if (!img) return;

    setIsResizing(true);
    setResizeDirection(direction);
    setInitialWidth(img.offsetWidth);
    setInitialHeight(img.offsetHeight);
    setInitialX(e.clientX);
    setInitialY(e.clientY);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;
      
      let newWidth = initialWidth;
      let newHeight = initialHeight;
      const aspectRatio = initialWidth / initialHeight;

      switch (resizeDirection) {
        case 'se': // Bottom-right - maintain aspect ratio
          newWidth = Math.max(50, initialWidth + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'sw': // Bottom-left - maintain aspect ratio
          newWidth = Math.max(50, initialWidth - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'ne': // Top-right - maintain aspect ratio
          newWidth = Math.max(50, initialWidth + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'nw': // Top-left - maintain aspect ratio
          newWidth = Math.max(50, initialWidth - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'e': // Right edge
          newWidth = Math.max(50, initialWidth + deltaX);
          break;
        case 'w': // Left edge
          newWidth = Math.max(50, initialWidth - deltaX);
          break;
      }

      updateAttributes({ 
        width: Math.round(newWidth),
        height: resizeDirection === 'e' || resizeDirection === 'w' ? null : Math.round(newHeight)
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, initialWidth, initialHeight, initialX, initialY, resizeDirection, updateAttributes]);

  const getContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'relative',
      maxWidth: '100%',
    };

    switch (alignment) {
      case 'left':
        return {
          ...base,
          float: 'left',
          marginRight: '1rem',
          marginBottom: '0.5rem',
          display: 'inline-block',
        };
      case 'right':
        return {
          ...base,
          float: 'right',
          marginLeft: '1rem',
          marginBottom: '0.5rem',
          display: 'inline-block',
        };
      case 'center':
        return {
          ...base,
          display: 'table',
          marginLeft: 'auto',
          marginRight: 'auto',
          float: 'none',
          clear: 'both',
        };
      default:
        // Default to left alignment
        return {
          ...base,
          float: 'left',
          marginRight: '1rem',
          marginBottom: '0.5rem',
          display: 'inline-block',
        };
    }
  };

  const containerStyle = getContainerStyle();

  const imgStyle: React.CSSProperties = {
    width: width ? `${width}px` : 'auto',
    height: height ? `${height}px` : 'auto',
    maxWidth: '100%',
    display: 'block',
    borderRadius: '0.5rem',
  };

  const handleStyle = (position: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: '12px',
      height: '12px',
      backgroundColor: 'var(--brand-primary, #3b82f6)',
      border: '2px solid white',
      borderRadius: '2px',
      zIndex: 10,
    };

    switch (position) {
      case 'nw': return { ...base, top: -6, left: -6, cursor: 'nwse-resize' };
      case 'ne': return { ...base, top: -6, right: -6, cursor: 'nesw-resize' };
      case 'sw': return { ...base, bottom: -6, left: -6, cursor: 'nesw-resize' };
      case 'se': return { ...base, bottom: -6, right: -6, cursor: 'nwse-resize' };
      case 'e': return { ...base, top: '50%', right: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' };
      case 'w': return { ...base, top: '50%', left: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' };
      default: return base;
    }
  };

  return (
    <NodeViewWrapper 
      ref={containerRef}
      style={containerStyle}
      className={`resizable-image-wrapper ${selected ? 'selected' : ''}`}
      data-drag-handle
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <img 
        src={src} 
        alt={alt || ''} 
        title={title || ''} 
        style={imgStyle}
        draggable={false}
      />
      {selected && (
        <>
          <div 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              border: '2px solid var(--brand-primary, #3b82f6)',
              borderRadius: '0.5rem',
              pointerEvents: 'none'
            }} 
          />
          <div style={handleStyle('nw')} onMouseDown={(e) => startResize(e, 'nw')} />
          <div style={handleStyle('ne')} onMouseDown={(e) => startResize(e, 'ne')} />
          <div style={handleStyle('sw')} onMouseDown={(e) => startResize(e, 'sw')} />
          <div style={handleStyle('se')} onMouseDown={(e) => startResize(e, 'se')} />
          <div style={handleStyle('e')} onMouseDown={(e) => startResize(e, 'e')} />
          <div style={handleStyle('w')} onMouseDown={(e) => startResize(e, 'w')} />
        </>
      )}
      {/* Clickable area below image to move cursor after - 60px for easier clicking */}
      <div 
        onClick={moveCursorAfterImage}
        style={{
          position: 'absolute',
          bottom: -60,
          left: -10,
          right: -10,
          height: 60,
          cursor: 'text',
        }}
        title="Click to continue writing below"
      />
      {/* Clickable area to the right of left-aligned images */}
      {(alignment === 'left' || alignment === 'right') && (
        <div 
          onClick={moveCursorAfterImage}
          style={{
            position: 'absolute',
            top: 0,
            [alignment === 'left' ? 'right' : 'left']: -60,
            width: 60,
            height: '100%',
            cursor: 'text',
          }}
          title="Click to write beside image"
        />
      )}
    </NodeViewWrapper>
  );
}
