"use client";

import * as React from "react";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SemanticSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  onSemanticSearch: (value: string) => Promise<void>;
  isSearching?: boolean;
  showClear?: boolean;
  inputSize?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 text-sm leading-[1.2] pl-8 pr-16",
  md: "h-10 text-sm leading-[1.2] pl-10 pr-20",
  lg: "h-12 text-sm leading-[1.2] pl-12 pr-24",
};

const iconSizeClasses = {
  sm: "w-4 h-4 left-2",
  md: "w-4 h-4 left-3",
  lg: "w-5 h-5 left-4",
};

const clearSizeClasses = {
  sm: "right-10",
  md: "right-12",
  lg: "right-14",
};

const buttonSizeClasses = {
  sm: "right-1 h-6 px-2 rounded-lg",
  md: "right-1.5 h-7 px-2.5 rounded-lg",
  lg: "right-2 h-8 px-3 rounded-lg",
};

export function SemanticSearchInput({
  value,
  onChange,
  onSemanticSearch,
  isSearching = false,
  showClear = true,
  inputSize = "md",
  className,
  placeholder = "Search...",
  ...props
}: SemanticSearchInputProps) {
  const size = inputSize;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim() && !isSearching) {
      e.preventDefault();
      await onSemanticSearch(value.trim());
    }
    if (e.key === "Escape") {
      onChange("");
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleSearchClick = async () => {
    if (value.trim() && !isSearching) {
      await onSemanticSearch(value.trim());
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)]",
          iconSizeClasses[size]
        )}
      >
        {isSearching ? (
          <Loader2 className="w-full h-full animate-spin text-[var(--brand)]" />
        ) : (
          <Search className="w-full h-full" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSearching}
        className={cn(
          "w-full box-border bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] transition-all",
          "focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          sizeClasses[size]
        )}
        {...props}
      />
      {showClear && value && !isSearching && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors",
            clearSizeClasses[size]
          )}
        >
          <X className="w-full h-full" />
        </button>
      )}
      <button
        type="button"
        onClick={handleSearchClick}
        disabled={!value.trim() || isSearching}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center gap-1 text-xs font-medium transition-all",
          "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--brand)]",
          buttonSizeClasses[size]
        )}
        title="Semantic search (Enter)"
      >
        {isSearching ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ArrowRight className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
