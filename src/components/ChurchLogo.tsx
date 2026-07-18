"use client";

import { useEffect, useState } from "react";

/**
 * Renders a church logo and, when it detects a dark logo drawn on a mostly
 * transparent background, automatically places it on a light backdrop so it
 * stays legible over the dark banner. Opaque icons that carry their own
 * background are left untouched. Detection is best-effort: cross-origin images
 * that block canvas reads simply fall back to the bare (transparent) treatment.
 */
export function ChurchLogo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [needsLight, setNeedsLight] = useState(false);

  useEffect(() => {
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
        let lumSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 32) continue; // skip transparent pixels
          opaque++;
          lumSum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        if (opaque < 8) return;

        const total = size * size;
        const transparentRatio = 1 - opaque / total;
        const avgLuminance = lumSum / opaque; // 0 (black) .. 255 (white)

        // Only intervene for genuine transparent logos whose ink is dark.
        // Full-bleed icons (little transparency) already read on any surface.
        if (!cancelled && transparentRatio > 0.12 && avgLuminance < 110) {
          setNeedsLight(true);
        }
      } catch {
        /* tainted canvas (no CORS) — keep the bare treatment */
      }
    };
    // Proxy through our own origin so the canvas can read the pixels even when
    // the logo's host doesn't send CORS headers.
    probe.src = `/api/img-probe?url=${encodeURIComponent(src)}`;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${className ?? ""} ${
        needsLight ? "bg-white/95 rounded-2xl p-2" : ""
      }`.trim()}
    />
  );
}
