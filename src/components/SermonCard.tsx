"use client";

import Link from "next/link";
import type { Sermon } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";
import { getPastorById } from "@/lib/pastors";
import { formatDuration, formatCount, formatRelative } from "@/lib/format";
import { usePlayer } from "./PlayerProvider";

type Props = {
  sermon: Sermon;
  /** Render a smaller compact card for sidebars / related lists. */
  compact?: boolean;
  /** Entrance animation delay in ms (used when staggering grids). */
  delayMs?: number;
};

export function SermonCard({ sermon, compact = false, delayMs = 0 }: Props) {
  const pastor = getPastorById(sermon.pastorId);
  const { play, current, isPlaying } = usePlayer();
  const isActive = current?.id === sermon.id && isPlaying;

  return (
    <article
      className="group fade-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
        <Link href={`/sermons/${sermon.slug}`} aria-label={sermon.title} className="block">
          <div className="relative rounded-xl overflow-hidden ring-1 ring-line group-hover:ring-gold/40 transition-shadow shadow-md shadow-black/30 group-hover:shadow-xl group-hover:shadow-gold/10">
            <Thumbnail
              title={sermon.title}
              hue={sermon.hue}
              label={sermon.scripture}
              size={compact ? "sm" : "md"}
              className="!ring-0 transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* dim+vignette on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          </div>
        </Link>
        <button
          type="button"
          onClick={() => play(sermon)}
          aria-label={`Play ${sermon.title}`}
          className="absolute right-3 bottom-3 inline-flex items-center justify-center w-11 h-11 rounded-full bg-gold text-ink shadow-lg shadow-black/40 translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-gold-hot active:scale-95 transition-all"
        >
          {isActive ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
            </svg>
          )}
        </button>
        <span className="absolute left-3 bottom-3 text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink/85 text-cream tabular-nums ring-1 ring-line/60">
          {formatDuration(sermon.durationSec)}
        </span>
        {isActive && (
          <span className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-leaf/20 text-leaf ring-1 ring-leaf/40 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-leaf live-dot" />
            Playing
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        {pastor && (
          <Link
            href={`/pastors/${pastor.slug}`}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-cream ring-1 ring-line hover:ring-gold transition"
            style={{
              background: `linear-gradient(135deg, hsl(${pastor.hue},60%,32%), hsl(${(pastor.hue + 30) % 360},65%,18%))`,
            }}
            aria-label={pastor.name}
          >
            {pastor.initials}
          </Link>
        )}
        <div className="min-w-0">
          <Link
            href={`/sermons/${sermon.slug}`}
            className="block text-cream font-medium leading-snug hover:text-gold line-clamp-2 transition-colors"
          >
            {sermon.title}
          </Link>
          {pastor && (
            <Link
              href={`/pastors/${pastor.slug}`}
              className="block text-sm text-cream-muted hover:text-cream truncate transition-colors"
            >
              {pastor.name}
            </Link>
          )}
          <p className="text-xs text-cream-faint mt-0.5">
            {formatCount(sermon.viewsThisWeek)} listens · {formatRelative(sermon.publishedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
