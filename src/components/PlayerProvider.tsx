"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Sermon } from "@/lib/types";

/** How long a signed-out visitor may preview a sermon before we prompt them to
 * create an account or sign in to keep listening. */
const ANON_PREVIEW_SECONDS = 90;

type PlayerContextValue = {
  current: Sermon | null;
  isPlaying: boolean;
  progress: number; // seconds
  duration: number; // seconds
  play: (sermon: Sermon) => void;
  togglePlay: () => void;
  seek: (sec: number) => void;
  /** Distinct free streams remaining this month, or null for paid/unlimited. */
  streamsLeft: number | null;
  /** Internal: the shared <audio> element so a page-level player can read it. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  registerTimeUpdate: (fn: (t: number) => void) => () => void;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export function PlayerProvider({
  children,
  plan = null,
  monthlyListenedIds = [],
  freeMonthlyLimit = 3,
}: {
  children: React.ReactNode;
  /** Current user's plan, or null when signed out. */
  plan?: string | null;
  /** Distinct sermon ids the user has already streamed this month. */
  monthlyListenedIds?: string[];
  /** How many distinct sermons a free member may stream per month. */
  freeMonthlyLimit?: number;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = React.useState<Sermon | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const listenersRef = React.useRef<Set<(t: number) => void>>(new Set());

  // Latest current sermon, readable from the audio event handlers below.
  const currentRef = React.useRef<Sermon | null>(null);
  currentRef.current = current;

  // A transient "couldn't play" message shown when playback genuinely fails
  // (broken asset, network error) so failures aren't silently swallowed.
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const isPaid = plan === "devoted" || plan === "patron";
  // Distinct sermons streamed this month (seeded from the server, grows as the
  // user plays new ones in this session).
  const monthlyRef = React.useRef<Set<string>>(new Set(monthlyListenedIds));
  const [monthlyUsed, setMonthlyUsed] = React.useState(monthlyRef.current.size);
  const [gateSermon, setGateSermon] = React.useState<Sermon | null>(null);

  // Signed-out visitors get a short preview, then a sign-in prompt. Refs let the
  // audio event handlers (registered once) read the latest values.
  const signedOut = plan === null;
  const signedOutRef = React.useRef(signedOut);
  signedOutRef.current = signedOut;
  const previewEndedRef = React.useRef(false);
  const [showPreviewGate, setShowPreviewGate] = React.useState(false);
  const pathname = usePathname();

  const play = React.useCallback((sermon: Sermon) => {
    const el = audioRef.current;
    if (!el) return;

    // Restart the preview window each time a signed-out visitor hits play.
    if (signedOut) previewEndedRef.current = false;

    // Free plan: enforce the monthly streaming cap before playing anything new.
    if (!isPaid) {
      const alreadyCounted = monthlyRef.current.has(sermon.id);
      if (!alreadyCounted && monthlyRef.current.size >= freeMonthlyLimit) {
        setGateSermon(sermon);
        return;
      }
      if (!alreadyCounted) {
        monthlyRef.current.add(sermon.id);
        setMonthlyUsed(monthlyRef.current.size);
      }
    }

    if (current?.id !== sermon.id) {
      setCurrent(sermon);
      // Stream through the gated endpoint, which is the authoritative check for
      // the monthly cap and records the listen server-side before redirecting
      // to the real audio asset.
      el.src = `/api/stream/${sermon.id}`;
      el.load();
    }
    void el.play().catch((err: unknown) => {
      // Autoplay blocked or a newer load interrupted this one — both benign.
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") return;
      showToast("Couldn’t play this sermon. Please try again.");
    });
  }, [current, isPaid, freeMonthlyLimit, signedOut, showToast]);

  const togglePlay = React.useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) {
      // Don't let a signed-out visitor resume past the preview — re-prompt.
      if (signedOutRef.current && previewEndedRef.current) {
        setShowPreviewGate(true);
        return;
      }
      void el.play().catch(() => {});
    } else el.pause();
  }, [current]);

  const seek = React.useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, el.duration || sec));
    setProgress(el.currentTime);
  }, []);

  const registerTimeUpdate = React.useCallback((fn: (t: number) => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      setProgress(el.currentTime);
      for (const fn of listenersRef.current) fn(el.currentTime);
      // End the preview for signed-out visitors and ask them to sign in.
      if (
        signedOutRef.current &&
        !previewEndedRef.current &&
        el.currentTime >= ANON_PREVIEW_SECONDS
      ) {
        previewEndedRef.current = true;
        el.pause();
        setShowPreviewGate(true);
      }
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setIsPlaying(false);
    // The media resource failed to load or decode (broken enclosure, network
    // error, unsupported format). Surface it instead of failing silently.
    const onError = () => {
      if (!currentRef.current) return;
      setIsPlaying(false);
      showToast("Couldn’t play this sermon. Please try again.");
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
    };
  }, [showToast]);

  const value = React.useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying,
      progress,
      duration,
      play,
      togglePlay,
      seek,
      streamsLeft: isPaid ? null : Math.max(0, freeMonthlyLimit - monthlyUsed),
      audioRef,
      registerTimeUpdate,
    }),
    [current, isPlaying, progress, duration, play, togglePlay, seek, isPaid, freeMonthlyLimit, monthlyUsed, registerTimeUpdate]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Single shared <audio> element, always mounted. */}
      <audio ref={audioRef} preload="metadata" />
      {gateSermon && (
        <StreamLimitModal
          limit={freeMonthlyLimit}
          signedIn={plan !== null}
          onClose={() => setGateSermon(null)}
        />
      )}
      {showPreviewGate && (
        <PreviewGateModal
          next={pathname ?? "/"}
          onClose={() => setShowPreviewGate(false)}
        />
      )}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#1B2138] text-white ring-1 ring-white/15 shadow-xl shadow-black/30 pl-4 pr-2 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose/20 text-rose">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="text-sm">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}

function StreamLimitModal({
  limit,
  signedIn,
  onClose,
}: {
  limit: number;
  signedIn: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-3xl bg-ink-2 ring-1 ring-line p-7 shadow-2xl shadow-black/30">
        <div className="w-12 h-12 rounded-full bg-gold/15 text-gold ring-1 ring-gold/40 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-cream">
          You&rsquo;ve reached your {limit} free sermons
        </h2>
        <p className="text-cream-muted mt-2 text-sm leading-relaxed">
          The free Seeker plan includes {limit} sermons each month. Upgrade to{" "}
          <span className="text-gold">Devoted</span> for unlimited, ad-free
          streaming — plus shareable AI excerpts.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {signedIn ? (
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex-1 whitespace-nowrap inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
            >
              See plans
            </Link>
          ) : (
            <>
              <Link
                href="/auth/sign-up?next=/pricing"
                onClick={onClose}
                className="flex-1 whitespace-nowrap inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
              >
                Create account
              </Link>
              <Link
                href="/auth/sign-in?next=/pricing"
                onClick={onClose}
                className="flex-1 whitespace-nowrap inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-ink-4 text-cream font-medium hover:bg-line transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 rounded-full text-cream-muted hover:text-cream transition-colors text-sm"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function PreviewGateModal({
  next,
  onClose,
}: {
  next: string;
  onClose: () => void;
}) {
  const nextParam = `?next=${encodeURIComponent(next)}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-3xl bg-ink-2 ring-1 ring-line p-7 shadow-2xl shadow-black/30">
        <div className="w-12 h-12 rounded-full bg-gold/15 text-gold ring-1 ring-gold/40 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 14v-2a9 9 0 0 1 18 0v2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <rect x="3" y="14" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="17" y="14" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-cream">
          Enjoying the message?
        </h2>
        <p className="text-cream-muted mt-2 text-sm leading-relaxed">
          Create a free account to keep listening — you&rsquo;ll get sermons each
          month, follow the pastors you love, and pick up right where you left
          off.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/auth/sign-up${nextParam}`}
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
          >
            Create free account
          </Link>
          <Link
            href={`/auth/sign-in${nextParam}`}
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-ink-4 text-cream font-medium hover:bg-line transition-colors"
          >
            Sign in
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 rounded-full text-cream-muted hover:text-cream transition-colors text-sm"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

