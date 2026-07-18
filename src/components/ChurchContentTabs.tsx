"use client";

import { useState } from "react";
import type { Sermon } from "@/lib/types";
import { SermonCard } from "./SermonCard";

type Props = {
  churchName: string;
  sermons: Sermon[];
  podcasts: Sermon[];
};

/**
 * Church content, split into "Sermons" and "Podcast" tabs. When a church only
 * has one kind of content we skip the tab bar and just show that section.
 */
export function ChurchContentTabs({ churchName, sermons, podcasts }: Props) {
  const hasSermons = sermons.length > 0;
  const hasPodcasts = podcasts.length > 0;
  const [tab, setTab] = useState<"sermon" | "podcast">(
    hasSermons ? "sermon" : "podcast"
  );

  if (!hasSermons && !hasPodcasts) return null;

  const bothTabs = hasSermons && hasPodcasts;
  const items = tab === "sermon" ? sermons : podcasts;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
      {bothTabs ? (
        <div
          className="inline-flex items-center gap-1 rounded-full bg-ink-2 ring-1 ring-line p-1 mb-6"
          role="tablist"
          aria-label={`${churchName} content`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sermon"}
            onClick={() => setTab("sermon")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "sermon"
                ? "bg-gold text-ink"
                : "text-cream-muted hover:text-cream"
            }`}
          >
            Sermons
            <span className="ml-1.5 tabular-nums opacity-70">{sermons.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "podcast"}
            onClick={() => setTab("podcast")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "podcast"
                ? "bg-gold text-ink"
                : "text-cream-muted hover:text-cream"
            }`}
          >
            Podcast
            <span className="ml-1.5 tabular-nums opacity-70">{podcasts.length}</span>
          </button>
        </div>
      ) : (
        <h2 className="font-display text-2xl text-cream mb-5">
          {hasSermons ? "Sermons" : "Podcast"} from {churchName}
        </h2>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((s, i) => (
          <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
        ))}
      </div>
    </section>
  );
}
