"use client";

import * as React from "react";
import { toggleFollow } from "@/app/follows/actions";

type FollowButtonProps = {
  pastorId: string;
  initialFollowing: boolean;
  /** Visual size; the pastor header uses "lg". */
  size?: "sm" | "lg";
};

export function FollowButton({
  pastorId,
  initialFollowing,
  size = "lg",
}: FollowButtonProps) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const res = await toggleFollow(pastorId, following);
      if (!res.ok) setFollowing(following); // revert on failure
      else setFollowing(res.following);
    });
  }

  const pad = size === "lg" ? "px-4 py-2" : "px-3 py-1.5 text-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={following}
      className={`${pad} rounded-full font-medium transition-colors disabled:opacity-60 ${
        following
          ? "bg-ink-3 text-cream hover:bg-ink-4 ring-1 ring-line"
          : "bg-gold text-ink hover:bg-gold-hot"
      }`}
    >
      {following ? (
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m5 12 5 5L20 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Following
        </span>
      ) : (
        "Follow"
      )}
    </button>
  );
}
