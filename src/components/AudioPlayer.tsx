"use client";

import * as React from "react";
import type { Sermon } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { formatDuration, formatCount } from "@/lib/format";
import { Waveform } from "./Waveform";
import { PastorAvatar } from "./PastorAvatar";

type Props = { sermon: Sermon; startAt?: number };

/**
 * Full-width player used on the sermon detail page. Talks to the global
 * PlayerProvider so the mini-player stays in sync. `startAt` (from ?t=, e.g.
 * an Ask iWord citation) makes the first play begin at that second.
 */
export function AudioPlayer({ sermon, startAt }: Props) {
  const { play, togglePlay, isPlaying, current, progress, duration, seek } =
    usePlayer();
  const isThis = current?.id === sermon.id;
  // Pending deep-link seek: consumed by the first play of this sermon.
  const startAtRef = React.useRef(startAt && startAt > 0 ? startAt : null);
  const [pendingStart, setPendingStart] = React.useState(startAtRef.current);
  const displayProgress = isThis ? progress : 0;
  const displayDuration = isThis && duration ? duration : sermon.durationSec;
  const pastor = sermon.pastor;
  const fraction = displayDuration > 0 ? displayProgress / displayDuration : 0;
  // Deterministic "live listeners" number — varies by sermon, stable per session.
  const liveListeners = 40 + (parseInt(sermon.id.replace(/\D/g, ""), 10) * 137) % 380;

  const handlePrimary = () => {
    const jumpTo = startAtRef.current;
    if (jumpTo !== null) {
      startAtRef.current = null;
      setPendingStart(null);
      if (!isThis) {
        play(sermon);
        // Seek shortly after src changes so the engine accepts it.
        setTimeout(() => seek(jumpTo), 120);
      } else {
        seek(jumpTo);
        if (!isPlaying) togglePlay();
      }
      return;
    }
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

  // Artwork background — same deterministic gradient as Thumbnail, with the
  // real cover art layered over it when available and a scrim for legibility.
  const hue = sermon.hue;
  const bgA = `hsl(${hue}, 72%, 42%)`;
  const bgB = `hsl(${(hue + 38) % 360}, 74%, 26%)`;
  const bgC = `hsl(${(hue - 10 + 360) % 360}, 60%, 14%)`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl ring-1 ring-line shadow-lg shadow-black/10"
      style={{
        background: `radial-gradient(130% 110% at 18% 0%, ${bgA} 0%, ${bgB} 52%, ${bgC} 100%)`,
      }}
    >
      {sermon.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sermon.imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/72 to-black/85"
      />
      <div className="relative p-5 sm:p-6">
      <div className="flex items-center gap-3">
        {pastor && (
          <div className="hidden sm:block" aria-hidden>
            <PastorAvatar
              imageUrl={pastor.imageUrl}
              name={pastor.name}
              initials={pastor.initials}
              hue={pastor.hue}
              className="w-12 h-12 shrink-0 rounded-full text-xs ring-1 ring-line"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Now playing
          </div>
          <div className="text-white font-medium truncate">{sermon.title}</div>
        </div>
        {pendingStart !== null ? (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gold">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
            </svg>
            Starts at {formatDuration(pendingStart)}
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-leaf">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-leaf" aria-hidden />
            {formatCount(liveListeners)} listening now
          </div>
        )}
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
        <div className="mt-2 flex items-center justify-between text-xs text-white/65 tabular-nums">
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
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white/65 hover:text-white hover:bg-white/10 transition-colors"
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
