import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSubdomain(subdomain: string): boolean {
  const reservedSubdomains = [
    "www", "api", "app", "admin", "auth", "login", "signup",
    "mail", "support", "help", "docs", "blog", "status",
    "cdn", "static"
  ];
  
  if (reservedSubdomains.includes(subdomain.toLowerCase())) {
    return false;
  }
  
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
  return subdomainRegex.test(subdomain);
}

export function extractSubdomain(hostname: string, baseDomain: string): string | null {
  const parts = hostname.split(".");
  const baseParts = baseDomain.split(".");
  
  if (parts.length <= baseParts.length) {
    return null;
  }
  
  const subdomain = parts.slice(0, parts.length - baseParts.length).join(".");
  return subdomain || null;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Get current subdomain from the current window location
 */
export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  
  // Custom utility function defined in this file
  return extractSubdomain(hostname, baseDomain);
}
