"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    if (toast.type === "success" || toast.type === "info") {
      setTimeout(() => {
        removeToast(id);
      }, toast.type === "success" ? 3000 : 5000);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.slice(-3).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  };

  const styles = {
    success: "bg-[var(--status-success-bg)] border-[var(--status-success)] text-[var(--status-success)]",
    error: "bg-[var(--status-error-bg)] border-[var(--status-error)] text-[var(--status-error)]",
    warning: "bg-[var(--status-warning-bg)] border-[var(--status-warning)] text-[var(--status-warning)]",
    info: "bg-[var(--status-info-bg)] border-[var(--status-info)] text-[var(--status-info)]",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-[var(--radius-md)] border-2 shadow-[var(--shadow-lg)] animate-in slide-in-from-right",
        styles[toast.type]
      )}
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--text-primary)]">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
