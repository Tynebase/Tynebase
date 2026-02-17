"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  Link2, Copy, Check, Users, Loader2, Trash2, Mail
} from "lucide-react";
import {
  listDocumentShares,
  createShareLink,
  revokeShare,
  DocumentShare,
} from "@/lib/api/documents";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">("view");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen, documentId]);

  const fetchShares = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listDocumentShares(documentId);
      setShares(response.shares);
      
      // Find existing link share
      const linkShare = response.shares.find(s => s.share_token);
      if (linkShare) {
        setShareLink(`${window.location.origin}/share/${linkShare.share_token}`);
      }
    } catch (err) {
      console.error("Failed to fetch shares:", err);
      setError("Failed to load sharing settings");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    try {
      setCreating(true);
      setError(null);
      const response = await createShareLink(documentId, { permission: "view" });
      const url = `${window.location.origin}${response.share_url}`;
      setShareLink(url);
      setShares(prev => [...prev, response.share]);
    } catch (err) {
      console.error("Failed to create share link:", err);
      setError("Failed to create share link");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    
    try {
      setInviting(true);
      setError(null);
      // Note: This would need to look up user by email first
      // For now, we'll show an error since we need user_id
      setError("User invite by email coming soon. Use share link instead.");
    } catch (err) {
      console.error("Failed to invite:", err);
      setError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeShare(documentId, shareId);
      setShares(prev => prev.filter(s => s.id !== shareId));
      
      // Clear share link if we revoked a link share
      const revokedShare = shares.find(s => s.id === shareId);
      if (revokedShare?.share_token) {
        setShareLink(null);
      }
    } catch (err) {
      console.error("Failed to revoke share:", err);
      setError("Failed to revoke share");
    }
  };

  const userShares = shares.filter(s => s.shared_with && !s.share_token);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${documentTitle}"`}>
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Share Link Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Share Link
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--brand)]" />
            </div>
          ) : shareLink ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] truncate"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleCreateLink}
              disabled={creating}
              className="w-full gap-2"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Create Share Link
            </Button>
          )}
          
          <p className="text-xs text-[var(--dash-text-muted)] mt-2">
            Anyone with this link can view the document
          </p>
        </div>

        {/* Invite People Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Invite People
          </h3>
          
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)]"
            />
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value as "view" | "edit")}
              className="px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)]"
            >
              <option value="view">Can view</option>
              <option value="edit">Can edit</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invite"}
            </Button>
          </div>
        </div>

        {/* People with Access */}
        {userShares.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              People with Access
            </h3>
            
            <div className="space-y-2">
              {userShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-[var(--surface-ground)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs">
                      {(share.shared_user?.full_name || share.shared_user?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--dash-text-primary)]">
                        {share.shared_user?.full_name || share.shared_user?.email}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">
                        Can {share.permission}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeShare(share.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visibility Info */}
        <div className="pt-4 border-t border-[var(--dash-border-subtle)]">
          <p className="text-xs text-[var(--dash-text-muted)]">
            To share this document with the entire community, set its visibility to "Public" in document settings.
          </p>
        </div>
      </div>
    </Modal>
  );
}
