"use client";

import { useEffect, useState } from 'react';

interface CanvasImageProps {
  src: string;
  alt: string;
  className?: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

export function CanvasImage({ src, alt, className = '', fit = 'contain' }: CanvasImageProps) {
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

  const bgColor = isDarkMode ? '#1f2937' : '#ffffff';

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          display: 'block'
        }}
      />
    </div>
  );
}
