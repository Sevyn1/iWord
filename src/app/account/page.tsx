import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowedPastorIds } from "@/lib/follows";
import { getRecentSermonIds, getMonthlyListenedIds } from "@/lib/listens";
import { FREE_MONTHLY_STREAMS } from "@/lib/account";
import { PASTORS } from "@/lib/pastors";
import { getSermonById } from "@/lib/sermons";
import { SermonCard } from "@/components/SermonCard";
import { signOut } from "@/app/auth/actions";
import { isStripeConfigured } from "@/lib/stripe";
import { manageBilling } from "@/app/pricing/actions";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-2xl text-cream">Account unavailable</h1>
        <p className="text-cream-muted mt-2">
          Supabase isn&rsquo;t configured yet. Add your keys to{" "}
          <code className="text-gold">.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, location, email, plan, stripe_status")
    .eq("id", user.id)
    .single();

  const followedIds = await getFollowedPastorIds();
  const followed = PASTORS.filter((p) => followedIds.has(p.id));

  const recentIds = await getRecentSermonIds(6);
  const recent = recentIds
    .map((id) => getSermonById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  // Prefer the profile row, but fall back to the name/location captured on the
  // auth user at sign-up (user_metadata) before resorting to the email prefix.
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const metaLocation = (user.user_metadata?.location as string | undefined)?.trim();
  const name =
    profile?.full_name || metaName || user.email?.split("@")[0] || "Friend";
  const location = profile?.location || metaLocation || "";
  const initial = (name[0] ?? "?").toUpperCase();
  const plan = (profile?.plan as "free" | "devoted" | "patron" | undefined) ?? "free";
  const isPaid = plan === "devoted" || plan === "patron";
  const isPatron = plan === "patron";
  const pastDue = isPaid && profile?.stripe_status === "past_due";
  const planName = plan === "devoted" ? "Devoted" : plan === "patron" ? "Patron" : "Seeker";
  const billingEnabled = isStripeConfigured();

  // Free-plan monthly streaming usage.
  const monthlyUsed = isPaid ? 0 : (await getMonthlyListenedIds()).length;
  const monthlyLeft = Math.max(0, FREE_MONTHLY_STREAMS - monthlyUsed);
  const usagePct = Math.min(100, Math.round((monthlyUsed / FREE_MONTHLY_STREAMS) * 100));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      {/* Profile header */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold to-rose text-ink text-2xl font-semibold flex items-center justify-center shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-cream leading-tight">{name}</h1>
          <p className="text-cream-muted">{user.email}</p>
          {location && (
            <p className="text-cream-faint text-sm mt-0.5">{location}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isPaid ? (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 text-gold ring-1 ring-gold/40 px-3 py-1 text-xs font-medium transition hover:bg-gold/25 hover:ring-gold/60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="m12 3 2.6 5.27 5.82.85-4.21 4.1 1 5.8L12 16.9l-5.2 2.73 1-5.8-4.2-4.1 5.8-.85L12 3Z" />
                </svg>
                iWord+ {planName} member
              </Link>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-3 text-cream-muted ring-1 ring-line px-3 py-1 text-xs font-medium transition hover:text-cream hover:ring-cream-faint"
              >
                Free · {planName} plan
              </Link>
            )}
            {pastDue && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose/15 text-rose ring-1 ring-rose/40 px-3 py-1 text-xs font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Payment overdue
              </span>
            )}
            {isPaid && billingEnabled ? (
              <form action={manageBilling}>
                <button
                  type="submit"
                  className="text-xs text-cream-muted hover:text-cream underline underline-offset-2"
                >
                  Manage billing
                </button>
              </form>
            ) : (
              <Link
                href="/pricing"
                className="text-xs text-cream-muted hover:text-cream underline underline-offset-2"
              >
                {isPaid ? "Manage plan" : "Upgrade plan"}
              </Link>
            )}
          </div>
        </div>
        <form action={signOut} className="sm:ml-auto">
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-ink-3 hover:bg-ink-4 text-cream ring-1 ring-line"
          >
            Sign out
          </button>
        </form>
      </section>

      {/* Monthly streaming usage (free plan only) */}
      {!isPaid && (
        <section className="mt-8 rounded-2xl bg-ink-2 ring-1 ring-line p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-lg text-cream">This month&rsquo;s listening</h2>
            <p className="text-sm text-cream-muted">
              <span className={monthlyLeft === 0 ? "text-rose font-semibold" : "text-cream font-semibold"}>
                {monthlyLeft} of {FREE_MONTHLY_STREAMS}
              </span>{" "}
              free {monthlyLeft === 1 ? "sermon" : "sermons"} left
            </p>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-ink-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${monthlyLeft === 0 ? "bg-rose" : "bg-gold"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-cream-faint">
            {monthlyLeft === 0
              ? "You\u2019ve used all your free sermons this month."
              : `You\u2019ve streamed ${monthlyUsed} of ${FREE_MONTHLY_STREAMS} this month.`}{" "}
            <Link href="/pricing" className="text-gold hover:text-gold-hot underline underline-offset-2">
              Upgrade to Devoted
            </Link>{" "}
            for unlimited streaming.
          </p>
        </section>
      )}

      {/* Patron supporter identity */}
      {isPatron && (
        <section className="mt-8 rounded-2xl bg-gradient-to-br from-gold/15 to-ink-2 ring-1 ring-gold/30 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-gold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 3 2.6 5.27 5.82.85-4.21 4.1 1 5.8L12 16.9l-5.2 2.73 1-5.8-4.2-4.1 5.8-.85L12 3Z" />
            </svg>
            <h2 className="font-display text-lg">You&rsquo;re a Patron</h2>
          </div>
          <p className="mt-2 text-sm text-cream-muted max-w-prose">
            Thank you for supporting the work. As a Patron, 70% of your
            subscription goes to the pastors you follow—{" "}
            {followed.length > 0
              ? "the ones below."
              : "follow a pastor to direct your support."}
          </p>
          {followed.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {followed.map((p) => (
                <Link
                  key={p.id}
                  href={`/pastors/${p.slug}`}
                  className="flex items-center gap-2.5 rounded-full bg-ink-2 ring-1 ring-line pl-1.5 pr-4 py-1.5 hover:bg-ink-3 transition-colors"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ring-1 ring-line shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                    }}
                  >
                    {p.initials}
                  </span>
                  <span className="text-sm text-cream">{p.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Followed pastors */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl text-cream">Pastors you follow</h2>
          <Link href="/sermons" className="text-sm text-cream-muted hover:text-cream">
            Discover more →
          </Link>
        </div>

        {followed.length === 0 ? (
          <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-8 text-center">
            <p className="text-cream-muted">
              You aren&rsquo;t following anyone yet. Open a pastor&rsquo;s page and tap{" "}
              <span className="text-gold">Follow</span> to see their new messages here.
            </p>
            <Link
              href="/sermons"
              className="mt-5 inline-flex items-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
            >
              Browse sermons
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {followed.map((p) => (
              <Link
                key={p.id}
                href={`/pastors/${p.slug}`}
                className="flex items-center gap-4 rounded-2xl bg-ink-2 ring-1 ring-line p-4 hover:bg-ink-3 transition-colors"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold text-white ring-1 ring-line shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-cream font-medium truncate">{p.name}</div>
                  <div className="text-cream-muted text-sm truncate">{p.church}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recently played */}
      {recent.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl text-cream">Recently played</h2>
            <Link href="/sermons" className="text-sm text-cream-muted hover:text-cream">
              Browse all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recent.map((s) => (
              <SermonCard key={s.id} sermon={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
