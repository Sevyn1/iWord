import { manageBilling } from "@/app/pricing/actions";
import { planLabel, type Plan } from "@/lib/account";

/**
 * Site-wide banner shown when a paid member's latest charge failed and Stripe
 * is retrying (`past_due`). Access is preserved during the retry window; this
 * nudges them to fix their card before the subscription is canceled.
 */
export function BillingAlert({ plan }: { plan: Plan }) {
  return (
    <div className="bg-rose/10 border-b border-rose/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="text-sm text-cream flex items-start sm:items-center gap-2 flex-1">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            className="text-rose shrink-0 mt-0.5 sm:mt-0" aria-hidden="true"
          >
            <path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <span className="font-medium">Your last payment didn’t go through.</span>{" "}
            Update your payment method to keep your {planLabel(plan)} membership.
          </span>
        </p>
        <form action={manageBilling} className="shrink-0">
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-1.5 rounded-full bg-rose text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Update payment method
          </button>
        </form>
      </div>
    </div>
  );
}
