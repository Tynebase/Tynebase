"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select option",
  disabled = false,
  className,
  triggerClassName,
  align = "left",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange?.(option.value);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between gap-2 w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-left transition-colors",
          "hover:border-[var(--border-default)] focus:outline-none focus:border-[var(--brand-primary)]",
          disabled && "opacity-50 cursor-not-allowed",
          triggerClassName
        )}
      >
        <span className={cn(
          "truncate",
          selectedOption ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
        )}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon}
              {selectedOption.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={cn(
          "w-4 h-4 text-[var(--text-tertiary)] transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Menu */}
      {isOpen && (
        <div className={cn(
          "absolute z-50 mt-1 w-full min-w-[180px] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg p-1.5 animate-in fade-in slide-in-from-top-2 duration-150",
          align === "right" ? "right-0" : "left-0"
        )}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option)}
              disabled={option.disabled}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-left transition-colors rounded-lg",
                option.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-[var(--surface-ground)]",
                option.value === value && "bg-[var(--brand-primary)]/10"
              )}
            >
              <div className="flex items-center gap-2">
                {option.icon}
                <div>
                  <p className={cn(
                    "text-sm",
                    option.value === value ? "text-[var(--brand-primary)]" : "text-[var(--text-primary)]"
                  )}>
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="text-xs text-[var(--text-tertiary)]">{option.description}</p>
                  )}
                </div>
              </div>
              {option.value === value && (
                <Check className="w-4 h-4 text-[var(--brand-primary)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({ trigger, children, align = "left", className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div className={cn(
          "absolute z-50 mt-1 min-w-[180px] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-lg py-1 animate-in fade-in slide-in-from-top-2 duration-150",
          align === "right" ? "right-0" : "left-0"
        )}>
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ children, onClick, icon, destructive, disabled }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        destructive
          ? "text-red-500 hover:bg-red-500/10"
          : "text-[var(--text-primary)] hover:bg-[var(--surface-ground)]"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-[var(--border-subtle)]" />;
}
