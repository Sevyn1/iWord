"use client";

import * as React from "react";
import Link from "next/link";
import type { Sermon } from "@/lib/types";

/**
 * "Daily Bread" — a Shorts-style vertical feed of 60-second sermon excerpts.
 * One clip per screen with scroll-snap; the clip in view auto-plays through a
 * single shared <audio> element (unlocked by the user's first tap, as browser
 * autoplay policy requires). When a clip ends, the feed advances itself.
 */
export function ClipsFeed({ clips }: { clips: Sermon[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  // One shared audio element for the whole feed.
  React.useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const onTime = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audioRef.current = null;
    };
  }, []);

  // Advance to the next clip when the current one finishes.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const next = cardRefs.current[active + 1];
      if (next) next.scrollIntoView({ behavior: "smooth" });
      else audio.play().catch(() => {});
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [active]);

  // Track which clip is in view.
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { root, threshold: [0.6] }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [clips.length]);

  // Play the active clip (once the user has tapped at least once).
  React.useEffect(() => {
    const audio = audioRef.current;
    const clip = clips[active];
    if (!audio || !clip?.excerptUrl) return;
    setProgress(0);
    if (!started) return;
    if (audio.src !== clip.excerptUrl) audio.src = clip.excerptUrl;
    audio.currentTime = 0;
    audio.play().catch(() => setPlaying(false));
  }, [active, started, clips]);

  const togglePlay = () => {
    const audio = audioRef.current;
    const clip = clips[active];
    if (!audio || !clip?.excerptUrl) return;
    if (!started) {
      setStarted(true);
      if (audio.src !== clip.excerptUrl) audio.src = clip.excerptUrl;
      audio.play().catch(() => {});
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const share = async (clip: Sermon) => {
    const shareUrl = `${window.location.origin}/sermons/${clip.slug}`;
    const payload = {
      title: `${clip.title} — iWord`,
      text: clip.excerptText
        ? `“${clip.excerptText.slice(0, 140)}…”`
        : `Listen to a highlight from “${clip.title}”`,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className="h-[calc(100dvh-4rem)] overflow-y-auto snap-y snap-mandatory overscroll-contain"
    >
      {clips.map((clip, i) => {
        const isActive = i === active;
        const quote =
          clip.excerptText && /^[a-z]/.test(clip.excerptText)
            ? `…${clip.excerptText}`
            : clip.excerptText;
        const a = `hsl(${clip.hue}, 72%, 38%)`;
        const b = `hsl(${(clip.hue + 38) % 360}, 74%, 20%)`;
        const c = `hsl(${(clip.hue - 10 + 360) % 360}, 60%, 10%)`;
        return (
          <section
            key={clip.id}
            data-index={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="h-full snap-start flex items-stretch justify-center px-0 sm:px-6 sm:py-4"
          >
            <article
              className="relative w-full sm:max-w-md h-full sm:rounded-3xl overflow-hidden ring-1 ring-line cursor-pointer select-none"
              style={{
                background: `radial-gradient(130% 110% at 18% 0%, ${a} 0%, ${b} 52%, ${c} 100%)`,
              }}
              onClick={togglePlay}
            >
              {clip.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clip.imageUrl}
                  alt=""
                  loading={i < 3 ? "eager" : "lazy"}
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75" />

              {/* progress */}
              <div className="absolute top-0 inset-x-0 h-1 bg-white/15">
                <div
                  className="h-full bg-gold transition-[width] duration-200"
                  style={{ width: `${isActive ? Math.round(progress * 100) : 0}%` }}
                />
              </div>

              {/* header */}
              <div className="absolute top-4 inset-x-0 px-5 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Daily Bread
                </span>
                <span className="ml-auto text-[11px] text-white/60">
                  {i + 1} / {clips.length}
                </span>
              </div>

              {/* quote */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6">
                {quote && (
                  <blockquote className="font-display text-white text-xl sm:text-2xl leading-snug line-clamp-[8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                    “{quote}”
                  </blockquote>
                )}
              </div>

              {/* play state hint */}
              {isActive && !playing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-black/45 backdrop-blur ring-1 ring-white/25">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="#F5EFE2" aria-hidden>
                      <path d="M8 5.5a1 1 0 0 1 1.54-.84l10 6.5a1 1 0 0 1 0 1.68l-10 6.5A1 1 0 0 1 8 18.5v-13Z" />
                    </svg>
                  </span>
                </div>
              )}

              {/* footer */}
              <div className="absolute bottom-0 inset-x-0 px-5 pb-5 space-y-3">
                <div>
                  <div className="text-white font-medium leading-tight line-clamp-2">
                    {clip.title}
                  </div>
                  <div className="text-white/70 text-sm mt-0.5">
                    {clip.pastor?.name}
                    {clip.pastor?.church ? ` · ${clip.pastor.church}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sermons/${clip.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gold text-ink text-sm font-medium hover:bg-gold-hot transition-colors"
                  >
                    Hear the full sermon
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void share(clip);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 ring-1 ring-white/25 text-white text-sm backdrop-blur hover:bg-white/20 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 15V4m0 0 4 4m-4-4L8 8M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                    </svg>
                    {copied && isActive ? "Copied!" : "Share"}
                  </button>
                </div>
                {!started && isActive && (
                  <p className="text-white/60 text-xs">Tap anywhere to start listening</p>
                )}
              </div>
            </article>
          </section>
        );
      })}
    </div>
  );
}
