"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Poll, voteOnPoll, removePollVote } from "@/lib/api/discussions";
import { BarChart3, Check, Loader2 } from "lucide-react";

interface PollDisplayProps {
  poll: Poll;
  discussionId: string;
  onVote?: (updatedPoll: Poll) => void;
}

export function PollDisplay({ poll, discussionId, onVote }: PollDisplayProps) {
  const [localPoll, setLocalPoll] = useState<Poll>(poll);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async (optionId: string) => {
    if (isVoting) return;

    try {
      setIsVoting(true);
      setError(null);

      const response = await voteOnPoll(discussionId, optionId);
      setLocalPoll(response.poll);
      onVote?.(response.poll);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setIsVoting(false);
    }
  };

  const handleRemoveVote = async () => {
    if (isVoting) return;

    try {
      setIsVoting(true);
      setError(null);

      const response = await removePollVote(discussionId);
      setLocalPoll(response.poll);
      onVote?.(response.poll);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove vote");
    } finally {
      setIsVoting(false);
    }
  };

  const totalVotes = localPoll.total_votes;
  const hasVoted = localPoll.has_voted;
  const selectedOptionId = localPoll.selected_option_id;

  return (
    <div className="bg-[var(--surface-ground)] rounded-xl p-5 border border-[var(--dash-border-subtle)]">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-[var(--brand)]" />
        <h3 className="font-semibold text-[var(--dash-text-primary)]">{localPoll.question}</h3>
      </div>

      {error && (
        <div className="text-sm text-red-500 mb-3 bg-red-50 rounded-lg p-2">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {localPoll.options.map((option) => {
          const percentage = totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0;
          const isSelected = selectedOptionId === option.id;

          return (
            <div key={option.id} className="relative">
              {/* Progress bar background */}
              {hasVoted && (
                <div
                  className="absolute inset-0 rounded-lg bg-[var(--brand-primary-muted)] transition-all duration-300"
                  style={{ width: `${percentage}%`, opacity: isSelected ? 0.3 : 0.15 }}
                />
              )}

              <button
                onClick={() => !hasVoted && handleVote(option.id)}
                disabled={isVoting || hasVoted}
                className={`
                  relative w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all
                  ${hasVoted
                    ? isSelected
                      ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]/30"
                      : "border-[var(--dash-border-subtle)]"
                    : "border-[var(--dash-border-subtle)] hover:border-[var(--brand)] hover:bg-[var(--surface-hover)] cursor-pointer"
                  }
                  ${isVoting ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  {hasVoted && isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {hasVoted && !isSelected && (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--dash-border-subtle)]" />
                  )}
                  {!hasVoted && (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--dash-border-subtle)] group-hover:border-[var(--brand)]" />
                  )}
                  <span className="text-sm font-medium text-[var(--dash-text-primary)]">
                    {option.text}
                  </span>
                </div>

                {hasVoted && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--dash-text-secondary)]">
                      {option.votes_count}
                    </span>
                    <span className="text-xs text-[var(--dash-text-muted)] w-8 text-right">
                      {percentage}%
                    </span>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--dash-border-subtle)]">
        <div className="text-sm text-[var(--dash-text-muted)]">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </div>

        {hasVoted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveVote}
            disabled={isVoting}
          >
            {isVoting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Change vote"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
