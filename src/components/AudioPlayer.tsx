"use client";

import * as React from "react";
import type { Sermon } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { formatDuration, formatCount } from "@/lib/format";
import { Waveform } from "./Waveform";
import { getPastorById } from "@/lib/pastors";

type Props = { sermon: Sermon };

/**
 * Full-width player used on the sermon detail page. Talks to the global
 * PlayerProvider so the mini-player stays in sync.
 */
export function AudioPlayer({ sermon }: Props) {
  const { play, togglePlay, isPlaying, current, progress, duration, seek } =
    usePlayer();
  const isThis = current?.id === sermon.id;
  const displayProgress = isThis ? progress : 0;
  const displayDuration = isThis && duration ? duration : sermon.durationSec;
  const pastor = getPastorById(sermon.pastorId);
  const fraction = displayDuration > 0 ? displayProgress / displayDuration : 0;
  // Deterministic "live listeners" number — varies by sermon, stable per session.
  const liveListeners = 40 + (parseInt(sermon.id.replace(/\D/g, ""), 10) * 137) % 380;

  const handlePrimary = () => {
    if (!isThis) play(sermon);
    else togglePlay();
  };

  const skip = (delta: number) => {
    if (!isThis) {
      play(sermon);
      return;
    }
    seek(progress + delta);
  };

  const onWaveformSeek = (f: number) => {
    if (!isThis) {
      play(sermon);
      // Seek shortly after src changes so the engine accepts it.
      setTimeout(() => seek(f * sermon.durationSec), 80);
      return;
    }
    seek(f * displayDuration);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-ink-3 to-ink-2 ring-1 ring-line p-5 sm:p-6 shadow-lg shadow-black/10">
      <div className="flex items-center gap-3">
        {pastor && (
          <div
            className="hidden sm:flex w-12 h-12 shrink-0 rounded-full items-center justify-center text-xs font-semibold text-white ring-1 ring-line"
            style={{
              background: `linear-gradient(135deg, hsl(${pastor.hue},60%,32%), hsl(${(pastor.hue + 30) % 360},65%,18%))`,
            }}
            aria-hidden
          >
            {pastor.initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream-faint">
            Now playing
          </div>
          <div className="text-cream font-medium truncate">{sermon.title}</div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-leaf">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-leaf" aria-hidden />
          {formatCount(liveListeners)} listening now
        </div>
      </div>

      {/* Waveform scrubber */}
      <div className="mt-5">
        <Waveform
          seed={sermon.id}
          progress={fraction}
          isPlaying={isThis && isPlaying}
          onSeek={onWaveformSeek}
          height={64}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-cream-muted tabular-nums">
          <span>{formatDuration(displayProgress)}</span>
          <span>-{formatDuration(Math.max(0, displayDuration - displayProgress))}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <IconButton label="Back 15s" onClick={() => skip(-15)}>
          <BackIcon />
        </IconButton>
        <button
          type="button"
          onClick={handlePrimary}
          aria-label={isThis && isPlaying ? "Pause" : "Play"}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold text-ink hover:bg-gold-hot active:scale-95 transition-all shadow-lg shadow-gold/20"
        >
          {isThis && isPlaying ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
            </svg>
          )}
        </button>
        <IconButton label="Forward 30s" onClick={() => skip(30)}>
          <FwdIcon />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-cream-muted hover:text-cream hover:bg-ink-4 transition-colors"
    >
      {children}
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6" />
      <text x="12" y="16.5" fontSize="7" fontWeight="600" fill="currentColor" stroke="none" textAnchor="middle">15</text>
    </svg>
  );
}
function FwdIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6" />
      <text x="12" y="16.5" fontSize="7" fontWeight="600" fill="currentColor" stroke="none" textAnchor="middle">30</text>
    </svg>
  );
}
