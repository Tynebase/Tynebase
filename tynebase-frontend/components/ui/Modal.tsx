"use client";

import { useEffect, useCallback, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  // Track scroll position for restoration
  const [scrollPosition, setScrollPosition] = useState(0);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      setScrollPosition(window.scrollY);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      // Restore scroll position when modal closes
      window.scrollTo(0, scrollPosition);
    };
  }, [isOpen, handleEscape, scrollPosition]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Modal */}
        className={cn(
          "relative w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl shadow-xl animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-visible",
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            "relative flex-shrink-0",
            title ? "px-6 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6" : "px-6 pt-4 sm:px-8 sm:pt-4"
          )}>
            {title && (
              <div className={cn("flex justify-center", showCloseButton ? "pr-10" : "")}>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 sm:right-6 sm:top-4 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-ground)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "min-h-0 overflow-y-visible px-6 sm:px-8",
            title ? "pt-2 pb-6 sm:pt-3 sm:pb-8" : "py-6 sm:py-8"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-6 py-5 sm:px-8 sm:py-6 border-t border-[var(--border-subtle)] bg-[var(--surface-ground)] rounded-b-3xl mt-2 flex-shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
}
