"use client";

import * as React from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/format";

type Source = {
  n: number;
  sermonId: string;
  slug: string;
  title: string;
  pastor: string;
  church: string;
  startSec: number;
  quote: string;
};

const EXAMPLES = [
  "What does the Bible say about anxiety?",
  "How do I forgive someone who isn't sorry?",
  "What is justification by faith?",
  "How should Christians handle money?",
];

/**
 * Ask iWord — question box + grounded answer with citations that deep-link to
 * the exact moment in each sermon (/sermons/[slug]?t=SECONDS).
 * `compact` renders a tighter layout for the floating AskWidget panel.
 */
export function AskClient({ compact = false }: { compact?: boolean }) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [asked, setAsked] = React.useState<string | null>(null);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    setAsked(trimmed);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = (await res.json()) as { answer?: string; sources?: Source[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setAnswer(body.answer ?? "");
      setSources(body.sources ?? []);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className={`flex items-center gap-2 rounded-2xl bg-ink-2 ring-1 ring-line focus-within:ring-gold ${compact ? "p-1.5 pl-3" : "p-2 pl-4"}`}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything — answered from real sermons"
          maxLength={300}
          className={`flex-1 bg-transparent outline-none text-cream placeholder:text-cream-faint ${compact ? "text-sm py-1.5" : "text-sm sm:text-base py-2"}`}
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          className={`rounded-xl bg-gold text-ink text-sm font-medium hover:bg-gold-hot disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${compact ? "px-4 py-2" : "px-5 py-2.5"}`}
        >
          {loading ? "Searching…" : "Ask"}
        </button>
      </form>

      {!asked && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(compact ? EXAMPLES.slice(0, 2) : EXAMPLES).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                ask(ex);
              }}
              className="px-3 py-1.5 rounded-full bg-ink-2 ring-1 ring-line text-xs text-cream-muted hover:text-cream hover:ring-gold/50 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className={`${compact ? "mt-5" : "mt-8"} space-y-3`} aria-label="Searching sermons">
          <div className="h-4 w-3/4 rounded bg-ink-3 animate-pulse" />
          <div className="h-4 w-full rounded bg-ink-3 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-ink-3 animate-pulse" />
          <p className="text-xs text-cream-faint pt-1">
            Searching every transcribed sermon for “{asked}”…
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className={`${compact ? "mt-5" : "mt-8"} rounded-xl bg-rose/10 ring-1 ring-rose/40 px-4 py-3 text-sm text-rose`}>
          {error}
        </div>
      )}

      {answer !== null && !loading && (
        <div className={compact ? "mt-5" : "mt-8"}>
          <div className="text-xs uppercase tracking-[0.18em] text-cream-faint">Answer</div>
          <div className={`mt-3 space-y-4 text-cream/90 leading-relaxed ${compact ? "text-sm" : ""}`}>
            {answer.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{renderWithCitations(para)}</p>
            ))}
          </div>
          <p className="mt-4 text-xs text-cream-faint">
            AI‑generated from sermon transcripts — listen to the cited moments to hear each
            pastor in their own words.
          </p>

          {sources.length > 0 && (
            <div className={compact ? "mt-5" : "mt-8"}>
              <div className="text-xs uppercase tracking-[0.18em] text-cream-faint">
                From the sermons
              </div>
              <ul className="mt-3 space-y-3">
                {sources.map((s) => (
                  <li
                    key={s.n}
                    id={`ask-source-${s.n}`}
                    className={`rounded-2xl bg-ink-2 ring-1 ring-line scroll-mt-24 target:ring-gold/60 ${compact ? "p-3" : "p-4 sm:p-5"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold text-xs font-medium"
                      >
                        {s.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/sermons/${s.slug}?t=${s.startSec}`}
                          className="text-cream font-medium hover:text-gold"
                        >
                          {s.title}
                        </Link>
                        <div className="text-xs text-cream-muted mt-0.5">
                          {s.pastor}
                          {s.church ? ` · ${s.church}` : ""}
                        </div>
                        <blockquote className="mt-2 text-sm text-cream-muted border-l-2 border-gold/50 pl-3">
                          “{s.quote}”
                        </blockquote>
                      </div>
                      <Link
                        href={`/sermons/${s.slug}?t=${s.startSec}`}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 ring-1 ring-gold/40 text-gold text-xs font-medium hover:bg-gold/25 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
                        </svg>
                        Play {formatDuration(s.startSec)}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setAnswer(null);
              setSources([]);
              setAsked(null);
              setQuestion("");
            }}
            className={`${compact ? "mt-5" : "mt-8"} text-sm text-cream-muted hover:text-cream underline underline-offset-4`}
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}

/** Turn [n] markers into anchor links down to the matching source card. */
function renderWithCitations(text: string): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
    return (
      <a
        key={i}
        href={`#ask-source-${m[1]}`}
        className="align-super text-[0.7em] text-gold hover:text-gold-hot font-medium ml-0.5"
        aria-label={`Source ${m[1]}`}
      >
        [{m[1]}]
      </a>
    );
  });
}
