"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import { Button } from "@/components/ui/Button";
import { 
  FileText, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  User,
  ArrowLeft,
  Lock
} from "lucide-react";
import Link from "next/link";

interface SharedDocument {
  id: string;
  title: string;
  content: string;
  visibility: string;
  status: string;
  author_id: string;
  tenant_id: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

interface ShareResponse {
  success: boolean;
  data: {
    document: SharedDocument;
    permission: 'view' | 'edit';
  };
}

export default function SharedDocumentPage() {
  const params = useParams();
  const token = params.token as string;

  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setErrorCode(null);

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/share/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setErrorCode(data.error?.code || 'UNKNOWN');
          if (response.status === 404) {
            setError('This share link is invalid or has been revoked.');
          } else if (response.status === 410) {
            setError('This share link has expired.');
          } else {
            setError(data.error?.message || 'Failed to load shared document.');
          }
          return;
        }

        setDocument(data.data.document);
        setPermission(data.data.permission);
      } catch (err) {
        console.error('Failed to fetch shared document:', err);
        setError('Failed to load shared document. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSharedDocument();
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          {errorCode === 'EXPIRED' ? (
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          ) : errorCode === 'NOT_FOUND' ? (
            <Lock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          ) : (
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {errorCode === 'EXPIRED' ? 'Link Expired' : 'Document Unavailable'}
          </h1>
          <p className="text-slate-600 mb-6">
            {error || "The document you're looking for doesn't exist or you don't have access."}
          </p>
          <Link href="/">
            <Button variant="primary" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go to Homepage
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const authorName = document.users?.full_name || document.users?.email || 'Unknown Author';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-slate-900 truncate">
                  {document.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">{authorName}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                permission === 'edit' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {permission === 'edit' ? 'Can Edit' : 'View Only'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Document Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8 lg:p-12">
            <MarkdownReader content={document.content || ''} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Shared via{' '}
            <Link href="/" className="text-blue-600 hover:underline font-medium">
              TyneBase
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
