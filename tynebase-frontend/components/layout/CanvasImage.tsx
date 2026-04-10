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
  const [isDarkMode, setIsDarkMode] = useState(true);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Load and draw image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Clear canvas with background color
      const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate scaling to fit image while maintaining aspect ratio
      const imgAspect = img.width / img.height;
      const canvasAspect = canvas.width / canvas.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        // Image is wider than canvas - fit to width
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        // Image is taller than canvas - fit to height
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      }

      // Draw image centered
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    };

    img.onerror = () => {
      // Fallback if image fails to load
      const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isDarkMode ? '#9ca3af' : '#374151';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image not available', canvas.width / 2, canvas.height / 2);
    };

    img.src = src;
  }, [src, containerWidth, containerHeight, isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
}
