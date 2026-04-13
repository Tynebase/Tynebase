"use client";

import { useEffect, useRef, useState } from 'react';

interface CanvasImageProps {
  src: string;
  alt: string;
  className?: string;
  containerWidth?: number;
  containerHeight?: number;
}

export function CanvasImage({ src, alt, className = '', containerWidth = 1200, containerHeight = 500 }: CanvasImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: containerWidth, height: containerHeight });

  useEffect(() => {
    // Check theme on mount and when it changes
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme !== 'light');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // Responsive canvas sizing using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Set canvas internal size to match display size for crisp rendering
        // Use device pixel ratio for sharp rendering on high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        setCanvasSize({
          width: width * dpr,
          height: height * dpr
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on actual display size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Scale context for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    // Load and draw image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Clear canvas with background color
      const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // Calculate scaling to contain the entire image (like object-fit: contain)
      const imgAspect = img.width / img.height;
      const canvasAspect = (canvas.width / dpr) / (canvas.height / dpr);

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        // Image is wider than canvas - fit to width, show full height
        drawWidth = canvas.width / dpr;
        drawHeight = drawWidth / imgAspect;
        drawX = 0;
        drawY = ((canvas.height / dpr) - drawHeight) / 2;
      } else {
        // Image is taller than canvas - fit to height, show full width
        drawHeight = canvas.height / dpr;
        drawWidth = drawHeight * imgAspect;
        drawX = ((canvas.width / dpr) - drawWidth) / 2;
        drawY = 0;
      }

      // Draw image centered
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    };

    img.onerror = () => {
      // Fallback if image fails to load
      const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.fillStyle = isDarkMode ? '#9ca3af' : '#374151';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image not available', (canvas.width / dpr) / 2, (canvas.height / dpr) / 2);
    };

    img.src = src;
  }, [src, canvasSize, isDarkMode]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
}
