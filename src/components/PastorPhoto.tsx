"use client";

import { useEffect, useState } from "react";

type Props = {
  imageUrl?: string;
  name: string;
  initials: string;
  hue: number;
};

/**
 * The pastor's avatar in the profile header. When a real photo exists it is
 * clickable and opens a lightbox so visitors can see it larger and confirm it
 * is the right pastor. The initials fallback is not interactive.
 */
export function PastorPhoto({ imageUrl, name, initials, hue }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!imageUrl) {
    return (
      <div
        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-3xl font-semibold text-white ring-2 ring-white/25 shrink-0 shadow-xl shadow-black/40"
        style={{
          background: `linear-gradient(135deg, hsl(${hue},68%,52%), hsl(${(hue + 30) % 360},72%,30%))`,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View larger photo of ${name}`}
        className="group relative w-28 h-28 sm:w-36 sm:h-36 rounded-full shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover ring-2 ring-white/25 shadow-xl shadow-black/40 bg-white/10"
        />
        <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
          >
            <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M11 8v6M8 11h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo of ${name}`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-auto rounded-2xl shadow-2xl ring-1 ring-white/15 bg-[#1B2138]"
            />
            <p className="mt-3 text-center text-white/85 text-sm">{name}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-[#1B2138] shadow-lg flex items-center justify-center hover:bg-white/90 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
