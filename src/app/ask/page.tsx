import Link from "next/link";
import { getCurrentAccount, isPaidPlan } from "@/lib/account";
import { AskClient } from "@/components/AskClient";

export const metadata = {
  title: "Ask iWord",
  description:
    "Ask any question about faith and get an answer drawn from real sermons — with citations that jump to the exact moment in the audio.",
};

/**
 * Ask iWord — the flagship paid feature. Paid members get the question box;
 * everyone else sees what it does and an upgrade path.
 */
export default async function AskPage() {
  const account = await getCurrentAccount();
  const canAsk = isPaidPlan(account?.plan);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-gold mb-2">Ask iWord</p>
      <h1 className="font-display text-3xl sm:text-4xl text-cream leading-tight">
        Ask anything. Hear it answered from the pulpit.
      </h1>
      <p className="mt-3 text-cream-muted max-w-2xl">
        Ask a question about faith, scripture, or life — iWord searches every
        transcribed sermon in the library and answers from what the pastors
        actually preached, with citations that jump to the exact moment in the
        audio.
      </p>

      <div className="mt-8">
        {canAsk ? (
          <AskClient />
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-gold/10 via-ink-2 to-ink-2 ring-1 ring-gold/25 p-6 sm:p-8">
            <div className="text-cream font-medium">
              Ask iWord is a Devoted feature.
            </div>
            <p className="mt-2 text-sm text-cream-muted max-w-xl">
              Every answer is grounded in real sermons — no made-up theology —
              and every citation is a button that plays the sermon from the
              moment the pastor says it.
            </p>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Link
                href="/pricing"
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-gold text-ink text-sm font-medium hover:bg-gold-hot transition-colors"
              >
                Unlock with Devoted
              </Link>
              {!account && (
                <Link
                  href="/auth/sign-in?next=/ask"
                  className="text-sm text-cream-muted hover:text-cream underline underline-offset-4"
                >
                  Already a member? Sign in
                </Link>
              )}
            </div>
            <div className="mt-6 border-t border-line pt-5">
              <div className="text-xs uppercase tracking-[0.18em] text-cream-faint mb-2">
                For example
              </div>
              <ul className="space-y-1.5 text-sm text-cream-muted">
                <li>“What does the Bible say about anxiety?”</li>
                <li>“How do I forgive someone who isn&apos;t sorry?”</li>
                <li>“What is justification by faith?”</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
