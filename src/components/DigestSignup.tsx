"use client";

import * as React from "react";

/**
 * Homepage digest signup — stores the email via /api/newsletter/subscribe
 * (previously this form just redirected to sign-up without saving anything).
 */
export function DigestSignup() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div className="relative rounded-2xl bg-leaf/10 ring-1 ring-leaf/30 px-5 py-4 text-sm text-leaf">
        You&rsquo;re on the list — the next digest lands on Sunday. 🎉
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="flex-1 px-4 py-3 rounded-full bg-ink ring-1 ring-line focus:ring-gold outline-none text-cream placeholder:text-cream-faint"
      />
      <button
        type="submit"
        disabled={status === "busy"}
        className="px-5 py-3 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all disabled:opacity-60"
      >
        {status === "busy" ? "Signing up…" : "Get the digest"}
      </button>
      {status === "error" && (
        <p role="alert" className="sm:absolute sm:-bottom-7 text-xs text-rose">
          {message}
        </p>
      )}
    </form>
  );
}
