"use client";

interface RainbowProgressBarProps {
  isLoading: boolean;
  duration?: number;
}

export function RainbowProgressBar({ isLoading }: RainbowProgressBarProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden">
      <div
        className="h-full w-full"
        style={{
          background: 'linear-gradient(90deg, #4285f4, #ea4335, #fbbc04, #34a853, #4285f4)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
