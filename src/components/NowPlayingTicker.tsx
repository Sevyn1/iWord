"use client";

import Link from "next/link";
import type { Sermon } from "@/lib/types";
import { getPastorById } from "@/lib/pastors";

/**
 * "Now on iWord" marquee — gently scrolls the trending sermon titles across
 * the hero. Pure CSS animation; doubled list for seamless loop.
 */
export function NowPlayingTicker({ sermons }: { sermons: Sermon[] }) {
  if (sermons.length === 0) return null;
  const items = [...sermons, ...sermons]; // duplicate for seamless loop

  return (
    <div className="relative overflow-hidden border-y border-line bg-ink-2/40">
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink to-transparent z-10" />

      <div className="flex items-center gap-3 px-6 py-3">
        <span className="shrink-0 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold">
          <span className="w-1.5 h-1.5 rounded-full bg-gold live-dot" /> Now on iWord
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track flex items-center gap-10 whitespace-nowrap">
            {items.map((s, i) => {
              const pastor = getPastorById(s.pastorId);
              return (
                <Link
                  key={`${s.id}-${i}`}
                  href={`/sermons/${s.slug}`}
                  className="group inline-flex items-center gap-2 text-sm text-cream-muted hover:text-cream"
                >
                  <span className="text-gold/80 group-hover:text-gold">▸</span>
                  <span className="font-medium text-cream">{s.title}</span>
                  {pastor && <span className="text-cream-faint">· {pastor.name}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .ticker-track {
          animation: ticker 38s linear infinite;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
