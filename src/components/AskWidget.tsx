"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AskClient } from "./AskClient";
import { usePlayer } from "./PlayerProvider";

/**
 * Floating "Ask iWord" launcher shown in the bottom-right corner of every page
 * (except /ask itself and /admin). Opens a compact chat-style panel reusing
 * AskClient; the expand control jumps to the full /ask page. Paid members get
 * the question box, everyone else a short upsell — mirroring the /ask gate.
 */
export function AskWidget({ canAsk }: { canAsk: boolean }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { current } = usePlayer();

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/ask" || pathname === "/clips" || pathname.startsWith("/admin")) return null;

  // Sit above the MiniPlayer bar when something is playing.
  const offset = current ? "bottom-24" : "bottom-5";

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Ask iWord"
          className={`fixed ${offset} right-4 z-[60] flex w-[min(26rem,calc(100vw-2rem))] max-h-[min(80vh,42rem)] flex-col overflow-hidden rounded-2xl bg-ink ring-1 ring-line shadow-2xl shadow-black/50`}
        >
          <div className="flex items-center gap-2 border-b border-line bg-ink-2 px-4 py-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-gold" aria-hidden />
            <span className="text-sm font-medium text-cream">Ask iWord</span>
            <span className="text-[11px] text-cream-faint hidden sm:inline">
              answered from real sermons
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/ask"
                onClick={() => setOpen(false)}
                aria-label="Open full page"
                title="Open full page"
                className="rounded-lg p-1.5 text-cream-muted hover:text-cream hover:bg-ink-3 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-cream-muted hover:text-cream hover:bg-ink-3 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {canAsk ? (
              <AskClient compact />
            ) : (
              <div className="py-2">
                <p className="text-sm text-cream/90 leading-relaxed">
                  Ask a question about faith, scripture, or life — iWord answers from what
                  the pastors actually preached, with citations that jump to the exact
                  moment in the audio.
                </p>
                <p className="mt-3 text-xs text-cream-faint">Ask iWord is a Devoted feature.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/pricing"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gold text-ink text-sm font-medium hover:bg-gold-hot transition-colors"
                  >
                    Unlock with Devoted
                  </Link>
                  <Link
                    href="/auth/sign-in?next=/ask"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-xl ring-1 ring-line text-sm text-cream-muted hover:text-cream hover:ring-gold/50 transition-colors"
                  >
                    Already a member? Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask iWord"
          className={`fixed ${offset} right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-gold pl-3.5 pr-4 py-3 text-ink text-sm font-medium shadow-lg shadow-black/40 hover:bg-gold-hot transition-colors`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          </svg>
          Ask
        </button>
      )}
    </>
  );
}
