"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  children,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  className,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  }, [controlledOpen, onOpenChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, setIsOpen]);

  const positionClasses = {
    top: `bottom-full mb-${sideOffset}`,
    bottom: `top-full mt-${sideOffset}`,
    left: `right-full mr-${sideOffset}`,
    right: `left-full ml-${sideOffset}`,
  };

  const alignClasses = {
    start: side === "top" || side === "bottom" ? "left-0" : "top-0",
    center: side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : "top-1/2 -translate-y-1/2",
    end: side === "top" || side === "bottom" ? "right-0" : "bottom-0",
  };

  return (
    <div ref={popoverRef} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 min-w-[200px] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg p-4 animate-in fade-in zoom-in-95 duration-150",
            positionClasses[side],
            alignClasses[align],
            className
          )}
          style={{ marginTop: side === "bottom" ? sideOffset : undefined, marginBottom: side === "top" ? sideOffset : undefined }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function PopoverTrigger({ children }: PopoverTriggerProps) {
  return <>{children}</>;
}

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  return <div className={className}>{children}</div>;
}
