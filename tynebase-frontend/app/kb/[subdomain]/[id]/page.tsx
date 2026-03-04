"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  User, Clock, Eye, ArrowLeft, Loader2, AlertCircle,
  ThumbsUp, ThumbsDown, BookOpen,
} from "lucide-react";
import { getKBDocument, estimateReadTime } from "@/lib/api/kb";
import type { KBTenant } from "@/lib/api/kb";
import { TiptapReader } from "@/components/ui/TiptapReader";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function KBDocumentPage() {
  const params = useParams();
  const subdomain = params.subdomain as string;
  const documentId = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [tenant, setTenant] = useState<KBTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        setLoading(true);
        const data = await getKBDocument(subdomain, documentId);
        setDoc(data.document);
        setTenant(data.tenant);

        // Apply branding
        if (data.tenant.branding.primary_color) {
          document.documentElement.style.setProperty("--brand", data.tenant.branding.primary_color);
          document.documentElement.style.setProperty("--brand-primary", data.tenant.branding.primary_color);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Document not found");
      } finally {
        setLoading(false);
      }
    };
    if (documentId) fetchDoc();
  }, [subdomain, documentId]);

  const handleFeedback = (type: "up" | "down") => {
    setFeedback(type);
    setShowFeedbackThanks(true);
    // TODO: Send feedback to backend
    setTimeout(() => setShowFeedbackThanks(false), 3000);
  };

  const brandColor = tenant?.branding.primary_color || "#E85002";
  const companyName = tenant?.branding.company_name || tenant?.name || "Knowledge Base";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading article...</span>
        </div>
      </div>
    );
  }

  if (error || !doc || !tenant) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Article Not Found</h1>
          <p className="text-gray-400 mb-6">{error || "This article doesn't exist or is not publicly accessible."}</p>
          <Link
            href={`/kb/${subdomain}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge Base
          </Link>
        </div>
      </div>
    );
  }

  const authorName = doc.users?.full_name || "Unknown Author";
  const categoryName = doc.categories?.name;
  const categoryColor = doc.categories?.color || "#6b7280";
  const readTime = estimateReadTime(doc.content || "");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={`/kb/${subdomain}`} className="flex items-center gap-3 group">
            {tenant.branding.logo_url ? (
              <img src={tenant.branding.logo_url} alt={companyName} className="h-8 w-auto" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: brandColor }}
              >
                {companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-white text-lg leading-tight group-hover:text-[var(--brand)] transition-colors">
                {companyName}
              </h1>
              <p className="text-xs text-gray-500">Help Center</p>
            </div>
          </Link>
        </div>
      </header>

      {/* Back navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <Link
          href={`/kb/${subdomain}${doc.categories?.id ? `?category=${doc.categories.id}` : ''}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {categoryName || "Knowledge Base"}
        </Link>
      </div>

      {/* Article content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {categoryName && (
            <span
              className="inline-block px-3 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: `${categoryColor}20`,
                color: categoryColor,
              }}
            >
              {categoryName}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <User className="w-3.5 h-3.5" />
            {authorName}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            {readTime} min read
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Eye className="w-3.5 h-3.5" />
            {(doc.view_count || 0)} views
          </span>
          {doc.published_at && (
            <span className="text-sm text-gray-500">
              {formatDate(doc.published_at)}
            </span>
          )}
        </div>

        {/* Document body */}
        <TiptapReader
          content={doc.content || "No content available."}
          title={doc.title}
        />

        {/* Was this helpful? */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="text-center">
            {showFeedbackThanks ? (
              <p className="text-sm text-gray-400">Thanks for your feedback!</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">Was this article helpful?</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleFeedback("up")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      feedback === "up"
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Yes
                  </button>
                  <button
                    onClick={() => handleFeedback("down")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      feedback === "down"
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    No
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} {companyName}
          </p>
          <p className="text-xs text-gray-700">
            Powered by <span className="text-gray-500">TyneBase</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
