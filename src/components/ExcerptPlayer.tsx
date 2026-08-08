"use client";

import { useState } from "react";

/**
 * Player + share controls for the AI-generated ~60s sermon excerpt.
 * The clip lives in the public `excerpts` bucket, so the URL is shareable as-is.
 */
export function ExcerptPlayer({
  url,
  text,
  title,
  shareUrl,
}: {
  url: string;
  text?: string;
  title: string;
  shareUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  // Clips often start mid-sentence; a leading ellipsis reads intentional.
  const quote = text && /^[a-z]/.test(text) ? `…${text}` : text;

  async function share() {
    const payload = {
      title: `${title} — iWord`,
      text: text ? `“${text.slice(0, 140)}…”` : `Listen to a highlight from “${title}”`,
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // user dismissed the sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mt-4">
      {quote && (
        <blockquote className="text-sm text-cream leading-relaxed border-l-2 border-gold/60 pl-3 line-clamp-4">
          “{quote}”
        </blockquote>
      )}
      <audio controls preload="none" src={url} className="mt-4 w-full h-10">
        Your browser does not support audio playback.
      </audio>
      <button
        type="button"
        onClick={share}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 15V4m0 0 4 4m-4-4L8 8M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {copied ? "Link copied!" : "Share this excerpt"}
      </button>
    </div>
  );
}
