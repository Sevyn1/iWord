"use client";

import * as React from "react";

/**
 * Horizontal scroll-snap carousel used by the homepage rows (sermons,
 * pastors). Children lay out in a row; each child should set its own width
 * (e.g. w-72 shrink-0 snap-start). Desktop gets hover arrows; touch devices
 * swipe natively. Gently auto-advances while on screen (pausing on hover or
 * touch, looping back to the start, and respecting prefers-reduced-motion).
 * Scales to any item count without growing the page.
 */
export function Carousel({
  children,
  className,
  ariaLabel,
  autoAdvanceMs = 4500,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  /** Interval between automatic advances; 0 disables. */
  autoAdvanceMs?: number;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);
  const pausedRef = React.useRef(false);
  const inViewRef = React.useRef(false);

  const update = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  // Gentle auto-advance: only while visible and not being interacted with.
  React.useEffect(() => {
    if (!autoAdvanceMs) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = trackRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
      },
      { threshold: 0.4 }
    );
    io.observe(el);

    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track || pausedRef.current || !inViewRef.current) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
      else track.scrollBy({ left: Math.round(track.clientWidth * 0.85), behavior: "smooth" });
    }, autoAdvanceMs);

    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [autoAdvanceMs]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      className={`group/carousel relative ${className ?? ""}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <div
        ref={trackRef}
        role="list"
        aria-label={ariaLabel}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-px-1 pb-2 -mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {/* edge fades */}
      {canLeft && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-ink to-transparent" />
      )}
      {canRight && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink to-transparent" />
      )}

      {/* desktop arrows */}
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll back"
          onClick={() => scrollBy(-1)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 h-10 w-10 items-center justify-center rounded-full bg-ink-2/95 ring-1 ring-line text-cream shadow-lg shadow-black/30 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:ring-gold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll forward"
          onClick={() => scrollBy(1)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 h-10 w-10 items-center justify-center rounded-full bg-ink-2/95 ring-1 ring-line text-cream shadow-lg shadow-black/30 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:ring-gold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
