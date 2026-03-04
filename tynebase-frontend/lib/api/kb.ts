import type { Document } from './documents';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface KBTenant {
  id: string;
  subdomain: string;
  name: string;
  branding: {
    logo_url?: string;
    logo_dark_url?: string;
    favicon_url?: string;
    primary_color?: string;
    secondary_color?: string;
    company_name?: string;
  };
}

export interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  document_count: number;
}

export interface KBLandingData {
  tenant: KBTenant;
  categories: KBCategory[];
  totalDocuments: number;
  uncategorizedCount: number;
}

export interface KBDocumentsData {
  documents: (Document & {
    users?: { id: string; full_name: string; avatar_url: string | null };
    categories?: { id: string; name: string; color: string };
  })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface KBDocumentData {
  document: Document & {
    users?: { id: string; full_name: string; avatar_url: string | null };
    categories?: { id: string; name: string; color: string };
  };
  tenant: KBTenant;
}

/**
 * Fetch KB landing page data (tenant info + categories with doc counts)
 */
export async function getKBLanding(subdomain: string): Promise<KBLandingData> {
  const res = await fetch(`${API_BASE}/api/public/kb/${subdomain}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Knowledge base not found');
  }
  const data = await res.json();
  return data.data;
}

/**
 * Fetch KB documents list (optionally filtered by category/search)
 */
export async function getKBDocuments(
  subdomain: string,
  params?: { page?: number; limit?: number; category_id?: string; search?: string }
): Promise<KBDocumentsData> {
  const qp = new URLSearchParams();
  if (params?.page) qp.append('page', params.page.toString());
  if (params?.limit) qp.append('limit', params.limit.toString());
  if (params?.category_id) qp.append('category_id', params.category_id);
  if (params?.search) qp.append('search', params.search);

  const qs = qp.toString();
  const res = await fetch(`${API_BASE}/api/public/kb/${subdomain}/documents${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to fetch documents');
  }
  const data = await res.json();
  return data.data;
}

/**
 * Fetch a single KB document
 */
export async function getKBDocument(subdomain: string, id: string): Promise<KBDocumentData> {
  const res = await fetch(`${API_BASE}/api/public/kb/${subdomain}/documents/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Document not found');
  }
  const data = await res.json();
  return data.data;
}

/**
 * Estimate read time from content string
 */
export function estimateReadTime(content: string): number {
  if (!content) return 1;
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
