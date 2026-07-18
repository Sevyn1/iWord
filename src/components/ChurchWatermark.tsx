"use client";

import { useEffect, useState } from "react";

/**
 * Large, faint church-logo watermark for a themed header. It only renders when
 * the image is a genuine transparent logo mark — opaque photos or podcast-art
 * thumbnails would look busy behind the content, so those are skipped. Uses the
 * same-origin image proxy so the pixel probe works for cross-origin logos.
 */
export function ChurchWatermark({ src }: { src: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShow(false);

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
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] >= 32) opaque++;
        }
        const transparentRatio = 1 - opaque / (size * size);

        // A real logo mark has plenty of empty space around it; opaque
        // photos / thumbnails fill the frame and are excluded.
        if (!cancelled && transparentRatio > 0.35) setShow(true);
      } catch {
        /* tainted canvas — skip the watermark */
      }
    };
    probe.src = `/api/img-probe?url=${encodeURIComponent(src)}`;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!show) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="pointer-events-none select-none absolute -right-10 sm:-right-4 top-1/2 -translate-y-1/2 h-[150%] w-auto max-w-[55%] object-contain opacity-[0.12] mix-blend-soft-light"
    />
  );
}
