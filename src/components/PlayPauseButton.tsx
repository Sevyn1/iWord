"use client";

import { usePlayer } from "./PlayerProvider";

type Props = {
  /** Diameter in px. */
  size?: number;
  className?: string;
};

/**
 * Reads global player state. Toggles play/pause for whatever sermon is loaded.
 * Stays decorative if no sermon is currently loaded.
 */
export function PlayPauseButton({ size = 40, className }: Props) {
  const { isPlaying, togglePlay, current } = usePlayer();
  const disabled = !current;
  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={disabled}
      aria-label={isPlaying ? "Pause" : "Play"}
      className={`inline-flex items-center justify-center rounded-full bg-gold text-ink hover:bg-gold-hot transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {isPlaying ? (
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1.2" />
          <rect x="14" y="5" width="4" height="14" rx="1.2" />
        </svg>
      ) : (
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
        </svg>
      )}
    </button>
  );
}
