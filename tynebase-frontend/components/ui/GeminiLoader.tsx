"use client";

interface GeminiLoaderProps {
  children?: React.ReactNode;
  className?: string;
}

export function GeminiLoader({ children, className = "" }: GeminiLoaderProps) {
  return (
    <div className={`gemini-container ${className}`}>
      <div className="gemini-content">
        {children}
      </div>
    </div>
  );
}
