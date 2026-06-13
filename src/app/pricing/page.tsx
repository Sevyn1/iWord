import Link from "next/link";
import { TIERS } from "@/lib/pricing";
import { getCurrentAccount } from "@/lib/account";
import { startCheckout } from "./actions";

// Map a pricing tier id to the plan value stored on the profile.
function tierToPlan(tierId: string): "free" | "devoted" | "patron" {
  return tierId === "seeker" ? "free" : (tierId as "devoted" | "patron");
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; canceled?: string }>;
}) {
  const sp = await searchParams;
  const account = await getCurrentAccount();
  const currentPlan = account?.plan ?? null;
  const signedIn = account !== null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
      <header className="text-center max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.22em] text-gold mb-3">Plans</p>
        <h1 className="font-display text-4xl sm:text-5xl text-cream leading-tight">
          Choose how you want to listen.
        </h1>
        <p className="mt-4 text-cream-muted">
          Start free. Upgrade when iWord becomes part of your week. Cancel any
          time — your downloads are yours to keep.
        </p>
      </header>

      {sp.error && (
        <p className="mt-6 mx-auto max-w-md rounded-2xl bg-rose/15 ring-1 ring-rose/30 text-rose text-sm px-4 py-3 text-center">
          {sp.error}
        </p>
      )}
      {sp.canceled && (
        <p className="mt-6 mx-auto max-w-md rounded-2xl bg-ink-2 ring-1 ring-line text-cream-muted text-sm px-4 py-3 text-center">
          Your plan was changed to the free Seeker tier.
        </p>
      )}

      <div className="mt-14 grid md:grid-cols-3 gap-6">
        {TIERS.map((t) => {
          const plan = tierToPlan(t.id);
          const isCurrent = currentPlan === plan;
          return (
            <div
              key={t.id}
              className={`rounded-3xl p-7 ring-1 flex flex-col ${
                isCurrent
                  ? "bg-ink-3 ring-gold shadow-xl shadow-black/40"
                  : t.highlight
                    ? "bg-ink-3 ring-gold shadow-xl shadow-black/40"
                    : "bg-ink-2 ring-line"
              }`}
            >
              {isCurrent ? (
                <span className="self-start text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-leaf text-ink mb-3">
                  Your plan
                </span>
              ) : (
                t.highlight && (
                  <span className="self-start text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full bg-gold text-ink mb-3">
                    Most popular
                  </span>
                )
              )}
              <h2 className="font-display text-2xl text-cream">{t.name}</h2>
              <p className="text-cream-muted mt-1 text-sm">{t.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold text-cream">
                  ${t.priceMonthly}
                </span>
                <span className="text-cream-muted">/ month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                {t.features
                  .filter(
                    (f) =>
                      !(f === "Support as a patron" && currentPlan === "patron")
                  )
                  .map((f) => (
                    <li key={f} className="flex gap-2 text-cream-muted">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gold shrink-0 mt-0.5">
                        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
              </ul>

              <PlanButton
                tierId={t.id}
                tierName={t.name}
                plan={plan}
                priceMonthly={t.priceMonthly}
                highlight={Boolean(t.highlight)}
                isCurrent={isCurrent}
                signedIn={signedIn}
                currentPlan={currentPlan}
              />
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-cream-faint mt-10">
        Prices in USD. Secure payments by Stripe. Cancel anytime from your account.
      </p>
    </div>
  );
}

function PlanButton({
  tierId,
  tierName,
  plan,
  priceMonthly,
  highlight,
  isCurrent,
  signedIn,
  currentPlan,
}: {
  tierId: string;
  tierName: string;
  plan: "free" | "devoted" | "patron";
  priceMonthly: number;
  highlight: boolean;
  isCurrent: boolean;
  signedIn: boolean;
  currentPlan: "free" | "devoted" | "patron" | null;
}) {
  const baseClass =
    "mt-7 inline-flex items-center justify-center px-4 py-2.5 rounded-full font-medium transition-colors w-full";
  const solid = highlight
    ? "bg-gold text-ink hover:bg-gold-hot"
    : "bg-ink-4 text-cream hover:bg-line";

  if (isCurrent) {
    return (
      <span
        className={`${baseClass} bg-ink-2 text-cream-muted ring-1 ring-line cursor-default`}
      >
        Current plan
      </span>
    );
  }

  // Signed out → send them to sign up first, then come back to choose.
  if (!signedIn) {
    return (
      <Link
        href={
          priceMonthly === 0 ? "/auth/sign-up" : "/auth/sign-up?next=/pricing"
        }
        className={`${baseClass} ${solid}`}
      >
        {priceMonthly === 0 ? "Create free account" : `Start ${tierName}`}
      </Link>
    );
  }

  // Signed in → start checkout, switch plan, or downgrade via Stripe.
  const hasPaidPlan = currentPlan === "devoted" || currentPlan === "patron";
  const paidLabel = hasPaidPlan ? `Switch to ${tierName}` : `Start ${tierName}`;
  return (
    <form action={startCheckout} className="mt-auto">
      <input type="hidden" name="plan" value={plan} />
      <button type="submit" className={`${baseClass} ${solid}`}>
        {plan === "free" ? "Switch to free" : paidLabel}
      </button>
    </form>
  );
}
