"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Clock, Eye, ArrowLeft, Loader2, AlertCircle, ThumbsUp, ThumbsDown, FolderOpen } from "lucide-react";
import { getPublicDocument, Document } from "@/lib/api/documents";
import { getKBDocument, getKBLanding, getKBDocuments, estimateReadTime } from "@/lib/api/kb";
import type { KBTenant, KBCategory, KBDocumentsData } from "@/lib/api/kb";
import { TiptapReader } from "@/components/ui/TiptapReader";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DocsLayout, type DocsNavSection } from "@/components/docs/DocsLayout";

function getSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';

  const parts = hostname.split('.');
  const baseParts = baseDomain.split('.');

  if (parts.length > baseParts.length && hostname.endsWith(`.${baseDomain}`)) {
    const sub = parts.slice(0, parts.length - baseParts.length).join('.');
    if (sub && sub !== 'www') return sub;
    return null;
  }

  if (hostname !== 'localhost' && hostname !== baseDomain) {
    return hostname;
  }

  return null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Group a flat list of KB documents by category into sidebar sections for <DocsLayout>.
 * Documents without a category fall into a trailing "Uncategorized" section (only shown
 * when non-empty). Links target `/docs/{id}` to keep tenant routing unchanged.
 */
function buildTenantSections(
  categories: KBCategory[],
  documents: KBDocumentsData['documents']
): DocsNavSection[] {
  const byCategory = new Map<string, KBDocumentsData['documents']>();
  const uncategorized: KBDocumentsData['documents'] = [];

  for (const doc of documents) {
    if (doc.category?.id) {
      const list = byCategory.get(doc.category.id) ?? [];
      list.push(doc);
      byCategory.set(doc.category.id, list);
    } else {
      uncategorized.push(doc);
    }
  }

  const sections: DocsNavSection[] = categories
    .filter((cat) => !cat.parent_id)
    .map((cat) => ({
      id: cat.id,
      title: cat.name,
      articles: (byCategory.get(cat.id) ?? []).map((doc) => ({
        slug: doc.id,
        title: doc.title,
        href: `/docs/${doc.id}`,
      })),
    }))
    .filter((s) => s.articles.length > 0);

  if (uncategorized.length > 0) {
    sections.push({
      id: '__uncategorized__',
      title: 'Uncategorized',
      articles: uncategorized.map((doc) => ({
        slug: doc.id,
        title: doc.title,
        href: `/docs/${doc.id}`,
      })),
    });
  }

  return sections;
}

export default function PublicDocumentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = params.id as string;
  const fromDashboard = searchParams.get('from') === 'dashboard';

  const [doc, setDoc] = useState<Document | null>(null);
  const [tenant, setTenant] = useState<KBTenant | null>(null);
  const [tenantCategories, setTenantCategories] = useState<KBCategory[]>([]);
  const [tenantDocuments, setTenantDocuments] = useState<KBDocumentsData['documents']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);

  useEffect(() => {
    const sub = getSubdomainFromHost();
    setSubdomain(sub);

    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        if (sub) {
          // Tenant subdomain — fetch current doc, KB landing (categories), and doc list in parallel.
          const [docData, landing, docList] = await Promise.all([
            getKBDocument(sub, documentId),
            getKBLanding(sub).catch(() => null),
            getKBDocuments(sub, { limit: 500 }).catch(() => null),
          ]);

          setDoc(docData.document as any);
          setTenant(docData.tenant);
          if (landing?.categories) setTenantCategories(landing.categories);
          if (docList?.documents) setTenantDocuments(docList.documents);

          if (docData.tenant.branding.primary_color) {
            document.documentElement.style.setProperty("--brand", docData.tenant.branding.primary_color);
          }
        } else {
          // Main domain — public docs API.
          const response = await getPublicDocument(documentId);
          setDoc(response.document);
        }
      } catch (err) {
        console.error("Failed to fetch document:", err);
        setError(err instanceof Error ? err.message : "Document not found or not public");
      } finally {
        setLoading(false);
      }
    };

    if (documentId) fetchDocument();
  }, [documentId]);

  const handleFeedback = (type: "up" | "down") => {
    setFeedback(type);
    setShowFeedbackThanks(true);
    setTimeout(() => setShowFeedbackThanks(false), 3000);
  };

  const isTenantKB = !!subdomain;
  const brandColor = tenant?.branding.primary_color || "var(--brand)";
  const companyName = tenant?.branding.company_name || tenant?.name;
  const backHref = fromDashboard ? "/dashboard/community/shared-documents" : (isTenantKB ? "/docs" : "/public-documents");
  const backLabel = fromDashboard ? "Back to Shared Documents" : (isTenantKB ? `Back to ${companyName || 'Knowledge Base'}` : "Back to Public Documents");

  const sections = useMemo(
    () => buildTenantSections(tenantCategories, tenantDocuments),
    [tenantCategories, tenantDocuments]
  );

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        {!isTenantKB && <SiteNavbar currentPage="other" />}
        <div style={{ paddingTop: '200px', textAlign: 'center' }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen relative">
        <div className="hero-gradient" />
        {!isTenantKB && <SiteNavbar currentPage="other" />}
        <div style={{ paddingTop: '200px', textAlign: 'center', maxWidth: '500px', margin: '0 auto', padding: '0 20px' }}>
          <AlertCircle className="w-12 h-12 mx-auto" style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Document Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || "This document doesn't exist or is not publicly accessible."}</p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const authorName = doc.users?.full_name || (doc as any).author?.full_name || "Unknown Author";
  const categoryName = (doc as any).category?.name;
  const categoryColor = (doc as any).category?.color || "#6b7280";
  const readTime = estimateReadTime(doc.content || "");

  // ---------- Tenant KB: Supabase-style DocsLayout ----------
  if (isTenantKB && tenant) {
    const tenantHeader = (
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            maxWidth: '1400px',
            margin: '0 auto',
          }}
        >
          <Link href="/docs" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            {tenant.branding.logo_url ? (
              <img src={tenant.branding.logo_url} alt={companyName || ''} style={{ height: '32px', width: 'auto' }} />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  background: brandColor,
                }}
              >
                {(companyName || 'K').charAt(0)}
              </div>
            )}
            <div>
              <h1 style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>
                {companyName}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Help Center</p>
            </div>
          </Link>
        </div>
      </header>
    );

    const tenantFooter = (
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '32px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} {companyName}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Powered by <span style={{ color: 'var(--text-secondary)' }}>TyneBase</span>
          </p>
        </div>
      </footer>
    );

    // Feedback widget, rendered inside the content column after the markdown body.
    const feedbackWidget = (
      <div
        style={{
          marginTop: '48px',
          paddingTop: '32px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        {showFeedbackThanks ? (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Thanks for your feedback!</p>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Was this article helpful?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => handleFeedback('up')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: feedback === 'up' ? '1px solid #22c55e40' : '1px solid var(--border-subtle)',
                  background: feedback === 'up' ? '#22c55e10' : 'transparent',
                  color: feedback === 'up' ? '#22c55e' : 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <ThumbsUp style={{ width: '16px', height: '16px' }} /> Yes
              </button>
              <button
                onClick={() => handleFeedback('down')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: feedback === 'down' ? '1px solid #ef444440' : '1px solid var(--border-subtle)',
                  background: feedback === 'down' ? '#ef444410' : 'transparent',
                  color: feedback === 'down' ? '#ef4444' : 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <ThumbsDown style={{ width: '16px', height: '16px' }} /> No
              </button>
            </div>
          </>
        )}
      </div>
    );

    const meta: { label: string; value: string; color?: string }[] = [];
    if (categoryName) meta.push({ label: 'Category', value: categoryName, color: categoryColor });
    meta.push({ label: 'Author', value: authorName });
    meta.push({ label: 'Read time', value: `${readTime} min` });
    meta.push({ label: 'Views', value: String(doc.view_count || 0) });
    meta.push({ label: 'Updated', value: formatDate(doc.updated_at || doc.created_at) });
    if (doc.status !== 'published') meta.push({ label: 'Status', value: doc.status, color: '#f59e0b' });

    const breadcrumbs = [
      { label: companyName || 'Help Center', href: '/docs' },
      ...(categoryName ? [{ label: categoryName }] : []),
      { label: doc.title },
    ];

    // Sections may be empty briefly while the sidebar fetch is in flight — fall back to a
    // single-item nav that at least shows the current article so the layout never collapses.
    const finalSections: DocsNavSection[] = sections.length > 0
      ? sections
      : [{
          id: '__current__',
          title: 'Articles',
          articles: [{ slug: doc.id, title: doc.title, href: `/docs/${doc.id}` }],
        }];

    return (
      <DocsLayout
        sections={finalSections}
        currentSlug={doc.id}
        title={doc.title}
        content={doc.content || 'No content available.'}
        meta={meta}
        basePath="/docs"
        breadcrumbs={breadcrumbs}
        header={tenantHeader}
        footer={tenantFooter}
        afterContent={feedbackWidget}
      />
    );
  }

  // ---------- Main domain: single public document (unchanged layout) ----------
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <SiteNavbar currentPage="other" />

      <main style={{ paddingTop: '120px', paddingBottom: '60px' }}>
        <div className="container" style={{ maxWidth: '860px' }}>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm mb-6 hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            {categoryName && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                {categoryName}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <User className="w-4 h-4" />
              {authorName}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <Clock className="w-4 h-4" />
              {readTime} min read
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <Eye className="w-4 h-4" />
              {doc.view_count || 0} views
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {formatDate(doc.created_at)}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                background:
                  doc.visibility === 'public' ? '#10b98120' : doc.visibility === 'team' ? '#3b82f620' : '#6b728020',
                color: doc.visibility === 'public' ? '#10b981' : doc.visibility === 'team' ? '#3b82f6' : '#6b7280',
                textTransform: 'capitalize',
              }}
            >
              {doc.visibility}
            </span>
            {doc.status !== 'published' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: '#f59e0b20',
                  color: '#f59e0b',
                  textTransform: 'capitalize',
                }}
              >
                {doc.status}
              </span>
            )}
          </div>

          {doc.tags && doc.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
              {doc.tags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                  }}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}

          <TiptapReader content={doc.content || 'No content available.'} title={doc.title} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
