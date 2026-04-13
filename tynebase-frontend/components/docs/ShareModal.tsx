"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  Link2, Copy, Check, Users, Loader2, Trash2, Mail, ChevronDown, X
} from "lucide-react";
import {
  listDocumentShares,
  createShareLink,
  revokeShare,
  shareWithUser,
  DocumentShare,
} from "@/lib/api/documents";
import { listUsers, User } from "@/lib/api/users";
import { inviteUser } from "@/lib/api/invites";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
}

type Permission = "view" | "edit";

// A selected invitee — either a resolved workspace member or a raw email
interface Invitee {
  type: "member" | "email";
  user?: User;
  email: string;
  permission: Permission;
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initial = (name || email).charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs flex-shrink-0">
      {initial}
    </div>
  );
}

function PermissionSelect({
  value,
  onChange,
  compact = false,
}: {
  value: Permission;
  onChange: (v: Permission) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Permission)}
        className={`appearance-none pr-7 pl-3 py-1.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand)] ${compact ? "text-xs" : ""}`}
      >
        <option value="view">Can view</option>
        <option value="edit">Can edit</option>
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--dash-text-muted)] pointer-events-none" />
    </div>
  );
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite state
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
      fetchMembers();
    } else {
      // Reset invite state on close
      setQuery("");
      setInvitees([]);
      setShowSuggestions(false);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, documentId]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchShares = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listDocumentShares(documentId);
      setShares(response.shares);
      const linkShare = response.shares.find((s) => s.share_token);
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

  const fetchMembers = async () => {
    if (membersLoaded) return;
    try {
      const response = await listUsers({ limit: 200, status: "active" });
      setMembers(response.users);
      setMembersLoaded(true);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  // Filter members by query, excluding already-shared users and already-added invitees
  const sharedUserIds = new Set(shares.filter((s) => s.shared_with).map((s) => s.shared_with!));
  const inviteeIds = new Set(invitees.map((i) => i.user?.id).filter(Boolean) as string[]);
  const inviteeEmails = new Set(invitees.map((i) => i.email.toLowerCase()));

  const suggestions = query.trim().length > 0
    ? members.filter((m) => {
        if (sharedUserIds.has(m.id)) return false;
        if (inviteeIds.has(m.id)) return false;
        const q = query.toLowerCase();
        return (
          m.email.toLowerCase().includes(q) ||
          (m.full_name || "").toLowerCase().includes(q)
        );
      })
    : [];

  // Whether the raw query looks like an email that isn't already a member
  const queryIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const queryEmailIsMember = members.some((m) => m.email.toLowerCase() === query.trim().toLowerCase());
  const showAddByEmail =
    queryIsEmail &&
    !queryEmailIsMember &&
    !inviteeEmails.has(query.trim().toLowerCase());

  const handleSelectMember = (member: User) => {
    setInvitees((prev) => [
      ...prev,
      { type: "member", user: member, email: member.email, permission: "view" },
    ]);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleAddEmail = () => {
    const email = query.trim();
    if (!email || inviteeEmails.has(email.toLowerCase())) return;
    setInvitees((prev) => [
      ...prev,
      { type: "email", email, permission: "view" },
    ]);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveInvitee = (email: string) => {
    setInvitees((prev) => prev.filter((i) => i.email !== email));
  };

  const handleChangeInviteePermission = (email: string, permission: Permission) => {
    setInvitees((prev) =>
      prev.map((i) => (i.email === email ? { ...i, permission } : i))
    );
  };

  const handleSendInvites = async () => {
    if (invitees.length === 0) return;
    setSending(true);
    setError(null);
    setSuccessMsg(null);

    const errors: string[] = [];
    const added: string[] = [];

    for (const invitee of invitees) {
      try {
        if (invitee.type === "member" && invitee.user) {
          // Share document with existing workspace member
          const result = await shareWithUser(documentId, {
            user_id: invitee.user.id,
            permission: invitee.permission,
          });
          // Optimistically add to shares list
          setShares((prev) => {
            const exists = prev.find((s) => s.shared_with === invitee.user!.id);
            if (exists) return prev.map((s) => s.id === exists.id ? { ...s, permission: invitee.permission } : s);
            return [...prev, result.share];
          });
          added.push(invitee.user.full_name || invitee.email);
        } else {
          // External email — send a workspace invite
          await inviteUser({ email: invitee.email, role: "viewer" });
          added.push(invitee.email);
        }
      } catch (err: any) {
        console.error(`Failed to invite ${invitee.email}:`, err);
        errors.push(`${invitee.email}: ${err.message || "failed"}`);
      }
    }

    setSending(false);

    if (added.length > 0) {
      setInvitees([]);
      setSuccessMsg(
        added.length === 1
          ? `Invite sent to ${added[0]}`
          : `Invites sent to ${added.length} people`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    if (errors.length > 0) {
      setError(errors.join(" · "));
    }
  };

  const handleCreateLink = async () => {
    try {
      setCreating(true);
      setError(null);
      const response = await createShareLink(documentId, { permission: "view" });
      const url = `${window.location.origin}${response.share_url}`;
      setShareLink(url);
      setShares((prev) => [...prev, response.share]);
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

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeShare(documentId, shareId);
      const revoked = shares.find((s) => s.id === shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      if (revoked?.share_token) setShareLink(null);
    } catch (err) {
      console.error("Failed to revoke share:", err);
      setError("Failed to revoke share");
    }
  };

  const handleUpdateSharePermission = async (share: DocumentShare, permission: Permission) => {
    try {
      if (!share.shared_with) return;
      await shareWithUser(documentId, { user_id: share.shared_with, permission });
      setShares((prev) =>
        prev.map((s) => (s.id === share.id ? { ...s, permission } : s))
      );
    } catch (err) {
      console.error("Failed to update permission:", err);
      setError("Failed to update permission");
    }
  };

  const userShares = shares.filter((s) => s.shared_with && !s.share_token);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${documentTitle}"`}>
      <div className="space-y-6">
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* ── Invite People ─────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-medium text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Invite People
          </h3>

          {/* Search / tag input */}
          <div className="relative">
            <div
              className="flex flex-wrap gap-1.5 p-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg min-h-[42px] cursor-text focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:border-transparent"
              onClick={() => inputRef.current?.focus()}
            >
              {/* Invitee chips */}
              {invitees.map((invitee) => (
                <span
                  key={invitee.email}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-[var(--surface-raised)] border border-[var(--dash-border-subtle)] rounded-md text-xs text-[var(--dash-text-primary)] max-w-[180px]"
                >
                  <span className="truncate">
                    {invitee.user?.full_name || invitee.email}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveInvitee(invitee.email); }}
                    className="flex-shrink-0 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (suggestions.length > 0) handleSelectMember(suggestions[0]);
                    else if (showAddByEmail) handleAddEmail();
                  }
                  if (e.key === "Backspace" && query === "" && invitees.length > 0) {
                    handleRemoveInvitee(invitees[invitees.length - 1].email);
                  }
                }}
                placeholder={invitees.length === 0 ? "Add team members or emails…" : ""}
                className="flex-1 min-w-[140px] bg-transparent text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] outline-none py-0.5"
              />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && (suggestions.length > 0 || showAddByEmail) && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 mt-1 w-full bg-[var(--surface-raised)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg overflow-hidden"
              >
                {suggestions.map((member) => (
                  <button
                    key={member.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-ground)] transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectMember(member); }}
                  >
                    <Avatar name={member.full_name} email={member.email} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">
                        {member.full_name || member.email}
                      </p>
                      {member.full_name && (
                        <p className="text-xs text-[var(--dash-text-muted)] truncate">{member.email}</p>
                      )}
                    </div>
                    <span className="ml-auto text-xs text-[var(--dash-text-muted)] capitalize flex-shrink-0">
                      {member.role}
                    </span>
                  </button>
                ))}

                {showAddByEmail && (
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-ground)] transition-colors border-t border-[var(--dash-border-subtle)]"
                    onMouseDown={(e) => { e.preventDefault(); handleAddEmail(); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-raised)] border border-[var(--dash-border-subtle)] flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-[var(--dash-text-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">
                        {query.trim()}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">
                        Invite to workspace
                      </p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Per-invitee permission + Send row */}
          {invitees.length > 0 && (
            <div className="mt-3 space-y-2">
              {invitees.map((invitee) => (
                <div
                  key={invitee.email}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--surface-ground)] rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      name={invitee.user?.full_name ?? null}
                      email={invitee.email}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--dash-text-primary)] truncate">
                        {invitee.user?.full_name || invitee.email}
                      </p>
                      {invitee.user?.full_name && (
                        <p className="text-xs text-[var(--dash-text-muted)] truncate">{invitee.email}</p>
                      )}
                      {invitee.type === "email" && (
                        <p className="text-xs text-[var(--brand)]">Will be invited to workspace</p>
                      )}
                    </div>
                  </div>
                  <PermissionSelect
                    value={invitee.permission}
                    onChange={(v) => handleChangeInviteePermission(invitee.email, v)}
                    compact
                  />
                </div>
              ))}

              <Button
                variant="primary"
                className="w-full mt-1"
                onClick={handleSendInvites}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Send ${invitees.length === 1 ? "Invite" : `${invitees.length} Invites`}`
                )}
              </Button>
            </div>
          )}
        </div>

        {/* ── People with Access ────────────────────────────── */}
        {(loading || userShares.length > 0) && (
          <div>
            <h3 className="text-sm font-medium text-[var(--dash-text-primary)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              People with Access
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--brand)]" />
              </div>
            ) : (
              <div className="space-y-2">
                {userShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-2 p-3 bg-[var(--surface-ground)] rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={share.shared_user?.full_name ?? null}
                        email={share.shared_user?.email || "?"}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">
                          {share.shared_user?.full_name || share.shared_user?.email}
                        </p>
                        {share.shared_user?.full_name && (
                          <p className="text-xs text-[var(--dash-text-muted)] truncate">
                            {share.shared_user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PermissionSelect
                        value={share.permission}
                        onChange={(v) => handleUpdateSharePermission(share, v)}
                        compact
                      />
                      <button
                        onClick={() => handleRevokeShare(share.id)}
                        className="p-1.5 rounded-md text-[var(--dash-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Share Link ────────────────────────────────────── */}
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

        {/* ── Footer note ───────────────────────────────────── */}
        <div className="pt-4 border-t border-[var(--dash-border-subtle)]">
          <p className="text-xs text-[var(--dash-text-muted)]">
            To share with the entire community, set visibility to "Public" in document settings.
          </p>
        </div>
      </div>
    </Modal>
  );
}
