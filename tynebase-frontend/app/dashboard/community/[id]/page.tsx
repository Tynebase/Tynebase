"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent } from "@/components/ui/Card";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { PollDisplay } from "@/components/PollDisplay";
import { Poll } from "@/lib/api/discussions";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  MessageSquare,
  Pin,
  Send,
  ThumbsUp,
} from "lucide-react";

interface DiscussionMock {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  createdAt: string;
  replies: number;
  views: number;
  likes: number;
  isPinned: boolean;
  isResolved: boolean;
  tags: string[];
  poll?: Poll;
}

const discussions: DiscussionMock[] = [
  {
    id: 1,
    title: "Welcome to the TyneBase Community!",
    excerpt:
      "Introduce yourself and let us know what brings you here. We're excited to have you!",
    author: "Sarah Chen",
    category: "announcements",
    createdAt: "2 hours ago",
    replies: 24,
    views: 342,
    likes: 56,
    isPinned: true,
    isResolved: false,
    tags: ["welcome", "introduction"],
    poll: {
      id: "poll-1",
      question: "What feature would you like to see next?",
      options: [
        { id: "opt-1", text: "Dark mode", votes_count: 45 },
        { id: "opt-2", text: "Mobile app", votes_count: 32 },
        { id: "opt-3", text: "API integrations", votes_count: 28 },
        { id: "opt-4", text: "Team workspaces", votes_count: 19 },
      ],
      total_votes: 124,
      has_voted: false,
      created_at: "2026-02-01T10:00:00Z",
    } as Poll,
  },
  {
    id: 2,
    title: "How to set up webhooks for real-time notifications?",
    excerpt:
      "I'm trying to configure webhooks to get notified when documents are updated. Can someone guide me through the process?",
    author: "John Smith",
    category: "questions",
    createdAt: "5 hours ago",
    replies: 8,
    views: 127,
    likes: 12,
    isPinned: false,
    isResolved: true,
    tags: ["webhooks", "integrations"],
  },
  {
    id: 3,
    title: "Feature Request: Dark mode for the editor",
    excerpt:
      "Would love to see a dedicated dark mode for the document editor. The current theme is great but would be nice to have more contrast options.",
    author: "Emily Davis",
    category: "ideas",
    createdAt: "Yesterday",
    replies: 15,
    views: 234,
    likes: 89,
    isPinned: false,
    isResolved: false,
    tags: ["feature-request", "editor", "ui"],
  },
  {
    id: 4,
    title: "Best practices for organizing large knowledge bases",
    excerpt:
      "As our documentation grows, what are some recommended approaches for keeping everything organised and easily searchable?",
    author: "Mike Johnson",
    category: "questions",
    createdAt: "2 days ago",
    replies: 21,
    views: 456,
    likes: 34,
    isPinned: false,
    isResolved: false,
    tags: ["organization", "best-practices"],
  },
  {
    id: 5,
    title: "Monthly Community Roundup - January 2026",
    excerpt:
      "Here's a summary of all the amazing contributions from our community this month. Thank you all for being part of this journey!",
    author: "TyneBase Team",
    category: "announcements",
    createdAt: "3 days ago",
    replies: 7,
    views: 289,
    likes: 45,
    isPinned: true,
    isResolved: false,
    tags: ["roundup", "community"],
  },
];

export default function DiscussionPage({
  params,
}: {
  params: { id: string };
}) {
  const discussionId = useMemo(() => Number(params.id), [params.id]);
  const discussion = useMemo(
    () => discussions.find((d) => d.id === discussionId) ?? null,
    [discussionId]
  );

  const [reply, setReply] = useState("");

  if (!discussion) {
    return (
      <div className="min-h-full flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back to Community
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-lg font-semibold text-[var(--dash-text-primary)]">
              Discussion not found
            </div>
            <div className="text-sm text-[var(--dash-text-tertiary)] mt-2">
              The discussion you’re looking for doesn’t exist (yet).
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-8">
      <DashboardPageHeader
        left={
          <Button variant="ghost" size="md" className="px-3" asChild>
            <Link href="/dashboard/community">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        }
        title={
          <div className="flex items-center gap-2 justify-center">
            {discussion.isPinned && <Pin className="w-4 h-4 text-[var(--brand)]" />}
            {discussion.isResolved && (
              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
            )}
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
              {discussion.title}
            </h1>
          </div>
        }
        description={
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[var(--dash-text-tertiary)] mt-2">
            <span className="font-medium text-[var(--dash-text-secondary)]">
              {discussion.author}
            </span>
            <span>{discussion.createdAt}</span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              {discussion.replies} replies
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {discussion.views} views
            </span>
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4" />
              {discussion.likes} likes
            </span>
          </div>
        }
        right={
          <Button variant="primary" size="lg" className="gap-2 px-7" asChild>
            <Link href="/dashboard/community/new">
              <Send className="w-5 h-5" />
              New Discussion
            </Link>
          </Button>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6 min-h-0">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-sm flex-shrink-0">
                    {discussion.author.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--dash-text-primary)]">
                      {discussion.author}
                    </div>
                    <div className="text-sm text-[var(--dash-text-tertiary)]">
                      Posted {discussion.createdAt}
                    </div>
                  </div>
                </div>

                <div className="text-[var(--dash-text-primary)] leading-relaxed">
                  {discussion.excerpt}
                </div>

                {discussion.poll && (
                  <PollDisplay
                    poll={discussion.poll as Poll}
                    discussionId={discussion.id.toString()}
                  />
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {discussion.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs bg-[var(--surface-ground)] text-[var(--dash-text-muted)] rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Button variant="outline" size="md" className="px-5">
                    <ThumbsUp className="w-4 h-4" />
                    Like
                  </Button>
                  <Button variant="outline" size="md" className="px-5">
                    <MessageSquare className="w-4 h-4" />
                    Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-4">Replies</div>

              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="border border-[var(--dash-border-subtle)] rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-[var(--dash-text-secondary)] font-semibold text-xs flex-shrink-0">
                        U{i}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--dash-text-primary)]">
                          User {i}
                        </div>
                        <div className="text-xs text-[var(--dash-text-muted)]">1 day ago</div>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--dash-text-tertiary)] mt-3 leading-relaxed">
                      This is a placeholder reply. We can wire this up to real data once the backend/forum model is ready.
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-3">Write a reply</div>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Add a helpful reply..."
                rows={8}
                className="px-4 py-3 bg-[var(--surface-card)]"
              />
              <div className="flex items-center justify-end gap-3 mt-4">
                <Button variant="outline" size="md" className="px-5" onClick={() => setReply("")}
                  disabled={reply.trim().length === 0}
                >
                  Clear
                </Button>
                <Button variant="primary" size="md" className="px-5" disabled={reply.trim().length === 0}>
                  <Send className="w-4 h-4" />
                  Post Reply
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="font-semibold text-[var(--dash-text-primary)] mb-2">About</div>
              <div className="text-sm text-[var(--dash-text-tertiary)] space-y-2">
                <div>Keep conversations respectful and searchable.</div>
                <div>Mark resolved answers where applicable.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
