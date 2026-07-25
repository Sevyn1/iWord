"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Logo } from "@/components/Logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
      <div className="flex justify-center mb-8">
        <Logo size={40} showWordmark={false} />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-rose mb-3">Something broke</p>
      <h1 className="font-display text-3xl text-cream">We hit an unexpected snag</h1>
      <p className="text-cream-muted mt-3">
        Sorry about that — the page ran into an error. You can try again, or head
        back home.
      </p>
      {error.digest && (
        <p className="mt-4 text-xs text-cream-faint">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-ink-4 text-cream font-medium hover:bg-ink-3 active:scale-95 transition-all"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
