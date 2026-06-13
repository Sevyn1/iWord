"use client";

import Link from "next/link";
import { usePlayer } from "./PlayerProvider";
import { getPastorById } from "@/lib/pastors";
import { formatDuration } from "@/lib/format";
import { PlayPauseButton } from "./PlayPauseButton";

export function MiniPlayer() {
  const { current, progress, duration, seek, streamsLeft } = usePlayer();
  if (!current) return null;
  const pastor = getPastorById(current.pastorId);
  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-ink-2/95 backdrop-blur border-t border-line">
      <div className="h-0.5 bg-line">
        <div
          className="h-full bg-gold transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-5">
        <div
          className="w-11 h-11 rounded-md shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${current.hue},65%,30%), hsl(${(current.hue + 30) % 360},70%,18%))`,
          }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 sm:flex-none sm:w-56 md:w-64">
          <Link
            href={`/sermons/${current.slug}`}
            className="block truncate text-sm font-medium text-cream hover:text-gold"
          >
            {current.title}
          </Link>
          {pastor && (
            <Link
              href={`/pastors/${pastor.slug}`}
              className="block truncate text-xs text-cream-muted hover:text-cream"
            >
              {pastor.name} · {pastor.church}
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3 text-xs text-cream-muted tabular-nums flex-1 min-w-0 px-2">
          <span className="shrink-0 w-10 text-right">{formatDuration(progress)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className="scrubber flex-1 min-w-0"
            aria-label="Seek"
          />
          <span className="shrink-0 w-10">{formatDuration(duration)}</span>
        </div>

        <div className="ml-auto md:ml-0 shrink-0 flex items-center gap-2 sm:gap-3">
          {streamsLeft !== null && (
            <Link
              href="/pricing"
              title="Free monthly streams remaining"
              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                streamsLeft === 0
                  ? "bg-rose/15 text-rose ring-rose/30 hover:bg-rose/25"
                  : "bg-ink-3 text-cream-muted ring-line hover:text-cream"
              }`}
            >
              {streamsLeft === 0 ? "0 left · Upgrade" : `${streamsLeft} free left`}
            </Link>
          )}
          <PlayPauseButton />
        </div>
      </div>
    </div>
  );
}
