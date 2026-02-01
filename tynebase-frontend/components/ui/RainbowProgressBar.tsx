"use client";

import { useEffect, useState } from "react";

interface RainbowProgressBarProps {
  isLoading: boolean;
  duration?: number;
}

export function RainbowProgressBar({ isLoading, duration = 2000 }: RainbowProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      const timer = setTimeout(() => setProgress(0), 300);
      return () => clearTimeout(timer);
    }

    setProgress(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 90, 90);
      setProgress(newProgress);
    }, 50);

    return () => clearInterval(interval);
  }, [isLoading, duration]);

  if (progress === 0 && !isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1">
      <div
        className="h-full rainbow-gradient transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
