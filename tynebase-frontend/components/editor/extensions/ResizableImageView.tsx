"use client";

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [initialWidth, setInitialWidth] = useState(0);
  const [initialHeight, setInitialHeight] = useState(0);
  const [initialX, setInitialX] = useState(0);
  const [initialY, setInitialY] = useState(0);
  const [resizeDirection, setResizeDirection] = useState<string>('');

  const { src, alt, title, width, height, alignment } = node.attrs;

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
      default:
        return {
          ...base,
          display: 'table',
          marginLeft: 'auto',
          marginRight: 'auto',
          float: 'none',
          clear: 'both',
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
    </NodeViewWrapper>
  );
}
