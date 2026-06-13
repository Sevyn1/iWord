"use client";

import * as React from "react";

type Props = {
  /** Stable seed so the waveform shape stays the same for a given sermon. */
  seed: string;
  /** Number of bars. */
  bars?: number;
  /** Current playhead position 0..1. */
  progress: number;
  /** Whether the audio is currently playing — pulses bars near the playhead. */
  isPlaying?: boolean;
  /** Called with a fraction 0..1 of where the user clicked. */
  onSeek?: (fraction: number) => void;
  className?: string;
  height?: number;
};

/** Deterministic 0..1 pseudo-random from a string seed + index. */
function seededHeight(seed: string, i: number): number {
  let h = 2166136261 >>> 0;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= i + 1;
  h = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 3266489909) >>> 0;
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Lightweight static waveform with a moving playhead. Heights are derived
 * deterministically from the seed so the shape stays consistent across
 * renders, but we shape it with a gentle envelope so it doesn't look flat.
 */
export function Waveform({
  seed,
  bars = 72,
  progress,
  isPlaying = false,
  onSeek,
  className,
  height = 56,
}: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  const heights = React.useMemo(() => {
    return Array.from({ length: bars }, (_, i) => {
      const r = seededHeight(seed, i);
      // Soft envelope: louder in the middle, quieter at edges.
      const t = i / (bars - 1);
      const env = 0.55 + 0.45 * Math.sin(Math.PI * t);
      // Mix random with envelope.
      const v = 0.25 + 0.75 * r * env;
      return Math.max(0.12, Math.min(1, v));
    });
  }, [seed, bars]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, Math.min(1, x / rect.width)));
  };

  const playheadIndex = Math.floor(progress * bars);

  return (
    <div
      ref={ref}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek" : undefined}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number.isFinite(progress) ? Math.round(progress * 100) / 100 : 0}
      onClick={handleClick}
      className={`flex items-end gap-[2px] w-full select-none ${
        onSeek ? "cursor-pointer" : ""
      } ${className ?? ""}`}
      style={{ height }}
    >
      {heights.map((h, i) => {
        const past = i <= playheadIndex;
        const distance = Math.abs(i - playheadIndex);
        const isNearHead = isPlaying && distance <= 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-[1.5px] transition-colors duration-150"
            style={{
              height: `${Math.round(h * 100)}%`,
              background: past ? "var(--gold)" : "rgba(244,239,228,0.18)",
              transformOrigin: "bottom",
              animation: isNearHead ? "barPulse 700ms ease-in-out infinite" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
