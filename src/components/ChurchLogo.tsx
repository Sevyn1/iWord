"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a church logo and, when it detects a dark logo drawn on a mostly
 * transparent background, automatically places it on a light backdrop so it
 * stays legible over the dark banner. Opaque icons that carry their own
 * background are left untouched. Detection is best-effort: cross-origin images
 * that block canvas reads simply fall back to the bare (transparent) treatment.
 *
 * Self-healing: if the primary image fails to load (dead URL, 404, blocked by
 * the browser's opaque-response protection, a host that rotated its assets, …)
 * it transparently retries with `fallbackSrc` (the podcast artwork) and, if
 * that fails too, renders `children` — the caller's gradient/initials
 * placeholder — so the UI never shows a broken-image icon.
 */
export function ChurchLogo({
  src,
  fallbackSrc,
  alt,
  className,
  children,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [needsLight, setNeedsLight] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const triedFallback = useRef(false);

  // Reset when the primary source changes (e.g. a list row re-renders).
  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
    setNeedsLight(false);
    triedFallback.current = false;
  }, [src]);

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    setNeedsLight(false);

    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let opaque = 0;
        let dark = 0;
        let lumSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 32) continue; // skip transparent pixels
          opaque++;
          const lum =
            0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          lumSum += lum;
          if (lum < 90) dark++; // ink that would disappear on a dark banner
        }
        if (opaque < 8) return;

        const total = size * size;
        const transparentRatio = 1 - opaque / total;
        const avgLuminance = lumSum / opaque; // 0 (black) .. 255 (white)
        const darkFraction = dark / opaque;

        // Only intervene for genuine transparent logos (not full-bleed icons
        // that carry their own background). Add a light backdrop when the logo
        // is dark overall, OR contains a meaningful amount of dark ink that
        // would otherwise vanish (e.g. a dark wordmark beside a bright mark).
        if (
          !cancelled &&
          transparentRatio > 0.12 &&
          (avgLuminance < 120 || darkFraction > 0.25)
        ) {
          setNeedsLight(true);
        }
      } catch {
        /* tainted canvas (no CORS) — keep the bare treatment */
      }
    };
    // Proxy through our own origin so the canvas can read the pixels even when
    // the logo's host doesn't send CORS headers.
    probe.src = `/api/img-probe?url=${encodeURIComponent(currentSrc)}`;

    return () => {
      cancelled = true;
    };
  }, [currentSrc, failed]);

  // Both the primary and the fallback failed to load — show the placeholder.
  if (failed) return <>{children ?? null}</>;

  const handleError = () => {
    if (!triedFallback.current && fallbackSrc && fallbackSrc !== currentSrc) {
      triedFallback.current = true;
      setNeedsLight(false);
      setCurrentSrc(fallbackSrc);
    } else {
      setFailed(true);
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className={`${className ?? ""} ${
        needsLight
          ? "bg-white rounded-2xl p-2.5 shadow-lg shadow-black/20 ring-1 ring-black/5"
          : ""
      }`.trim()}
    />
  );
}
