"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * A church "brand plaque" used on the pastor header: the church logo + name
 * framed together as one unit. The plaque background is tinted with a soft,
 * pale version of the logo's own dominant colour so it blends with the mark
 * instead of sitting on stark white. Colour sampling is best-effort — if the
 * logo host blocks canvas reads we fall back to the church's brand hue, and if
 * that is unavailable the plaque stays white.
 */
export function ChurchPlaque({
  href,
  logoSrc,
  name,
  fallbackHue,
}: {
  href: string;
  logoSrc?: string;
  name: string;
  fallbackHue?: number;
}) {
  // tint = { bg, ring } CSS colour strings, or null while we resolve it.
  const [tint, setTint] = useState<{ bg: string; ring: string } | null>(
    fallbackHue != null
      ? {
          bg: `hsl(${fallbackHue} 34% 95%)`,
          ring: `hsl(${fallbackHue} 30% 82%)`,
        }
      : null,
  );

  useEffect(() => {
    if (!logoSrc) return;
    let cancelled = false;

    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      try {
        const size = 28;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Accumulate hue/saturation from vivid, opaque pixels (skip near-white,
        // near-black and greys — those carry no meaningful brand colour).
        let sumX = 0; // cos(hue) weighted by saturation
        let sumY = 0; // sin(hue) weighted by saturation
        let sumSat = 0;
        let vivid = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;
          const d = max - min;
          if (d === 0) continue; // grey
          const s = d / (1 - Math.abs(2 * l - 1));
          if (s < 0.2 || l < 0.12 || l > 0.9) continue;
          let h: number;
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60;
          if (h < 0) h += 360;
          const rad = (h * Math.PI) / 180;
          sumX += Math.cos(rad) * s;
          sumY += Math.sin(rad) * s;
          sumSat += s;
          vivid++;
        }

        if (!cancelled && vivid > 4 && sumSat > 0) {
          let hue = (Math.atan2(sumY, sumX) * 180) / Math.PI;
          if (hue < 0) hue += 360;
          const avgSat = Math.min(sumSat / vivid, 0.7);
          const sat = Math.round(avgSat * 45); // pale: cap saturation low
          setTint({
            bg: `hsl(${Math.round(hue)} ${sat}% 95%)`,
            ring: `hsl(${Math.round(hue)} ${sat + 8}% 82%)`,
          });
        }
      } catch {
        /* tainted canvas (no CORS) — keep the fallback tint */
      }
    };
    // Proxy through our own origin so the canvas can read cross-origin pixels.
    probe.src = `/api/img-probe?url=${encodeURIComponent(logoSrc)}`;

    return () => {
      cancelled = true;
    };
  }, [logoSrc]);

  return (
    <Link
      href={href}
      className="group mt-3 inline-flex items-center gap-3 rounded-2xl pl-3 pr-4 py-2.5 shadow-lg shadow-black/25 ring-1 ring-black/5 transition-shadow hover:shadow-xl"
      style={{
        backgroundColor: tint?.bg ?? "#ffffff",
        boxShadow: tint
          ? `0 10px 15px -3px rgba(0,0,0,0.25), inset 0 0 0 1px ${tint.ring}`
          : undefined,
      }}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          className="h-14 w-auto max-w-[180px] object-contain shrink-0"
        />
      ) : (
        <span
          className="h-12 w-12 shrink-0 rounded-xl"
          style={{
            background: fallbackHue != null
              ? `linear-gradient(135deg, hsl(${fallbackHue},68%,52%), hsl(${(fallbackHue + 30) % 360},72%,30%))`
              : "#1B2138",
          }}
          aria-hidden="true"
        />
      )}
      <span
        className="h-9 w-px shrink-0"
        style={{ backgroundColor: tint?.ring ?? "rgba(0,0,0,0.1)" }}
        aria-hidden="true"
      />
      <span className="font-semibold leading-tight text-[#1B2138] transition-colors group-hover:text-[#1B2138]/80">
        {name}
      </span>
    </Link>
  );
}
