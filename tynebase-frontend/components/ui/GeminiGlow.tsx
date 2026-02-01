"use client";

interface GeminiGlowProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GeminiGlow({ size = "md", className = "" }: GeminiGlowProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div className={`gemini-glow ${sizeClasses[size]} ${className}`}>
      <div className="gemini-glow-inner" />
    </div>
  );
}

export function GeminiThinkingBar({ className = "" }: { className?: string }) {
  return (
    <div className={`gemini-thinking-bar ${className}`}>
      <div className="gemini-thinking-gradient" />
    </div>
  );
}
