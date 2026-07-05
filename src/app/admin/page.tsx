import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { planLabel, type Plan } from "@/lib/account";
import { setUserPlan, setUserAdmin } from "./actions";

export const metadata = { title: "Admin" };

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: Plan;
  stripe_status: string | null;
  is_admin: boolean;
  created_at: string;
};

const PLANS: Plan[] = ["free", "devoted", "patron"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const currentAdminId = await requireAdmin();
  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="font-display text-3xl text-cream">Admin</h1>
        <p className="mt-4 text-cream-muted">
          The service-role key isn&apos;t configured, so admin data is
          unavailable. Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable this
          dashboard.
        </p>
      </div>
    );
  }

  const count = async (build: (q: ReturnType<typeof baseCount>) => unknown) => {
    const query = baseCount();
    const { count: c } = (await build(query)) as { count: number | null };
    return c ?? 0;
  };
  function baseCount() {
    return admin!.from("profiles").select("*", { count: "exact", head: true });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, freeCount, devotedCount, patronCount, pastDueCount, newCount] =
    await Promise.all([
      count((q) => q),
      count((q) => q.eq("plan", "free")),
      count((q) => q.eq("plan", "devoted")),
      count((q) => q.eq("plan", "patron")),
      count((q) => q.eq("stripe_status", "past_due")),
      count((q) => q.gte("created_at", weekAgo)),
    ]);

  let listQuery = admin
    .from("profiles")
    .select("id, email, full_name, plan, stripe_status, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (search) {
    listQuery = listQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }
  const { data: users } = await listQuery;
  const rows = (users ?? []) as ProfileRow[];

  const paying = devotedCount + patronCount;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-1">Admin</p>
          <h1 className="font-display text-3xl text-cream">Dashboard</h1>
        </div>
        <Link href="/" className="text-sm text-cream-muted hover:text-cream">
          ← Back to site
        </Link>
      </div>

      <div className="mt-6">
        <Link
          href="/admin/feeds"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink-2 ring-1 ring-line text-cream text-sm hover:bg-ink-3 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="5" cy="19" r="1.5" fill="currentColor" />
          </svg>
          Content feeds
          <span className="text-cream-faint">— manage ingestion sources</span>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total members" value={total} />
        <Stat label="Paying members" value={paying} accent />
        <Stat label="New this week" value={newCount} />
        <Stat label="Payment overdue" value={pastDueCount} warn={pastDueCount > 0} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat label="Seeker (free)" value={freeCount} small />
        <Stat label="Devoted" value={devotedCount} small />
        <Stat label="Patron" value={patronCount} small />
      </div>

      <div className="mt-10 rounded-2xl bg-ink-2 ring-1 ring-line overflow-hidden">
        <div className="p-5 border-b border-line flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-display text-xl text-cream">Members</h2>
          <form method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search name or email"
              className="px-3 py-1.5 rounded-full bg-ink ring-1 ring-line focus:ring-gold outline-none text-sm text-cream placeholder:text-cream-faint w-56"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-full bg-ink-4 text-cream text-sm hover:bg-ink-3"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-cream-faint text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Change plan</th>
                <th className="px-5 py-3 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-cream-muted">
                    No members found.
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-line align-middle">
                  <td className="px-5 py-3">
                    <div className="text-cream font-medium">
                      {u.full_name || "—"}
                    </div>
                    <div className="text-cream-faint text-xs">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        u.plan === "free"
                          ? "text-cream-muted"
                          : "text-gold font-medium"
                      }
                    >
                      {planLabel(u.plan)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.stripe_status === "past_due" ? (
                      <span className="text-rose">Past due</span>
                    ) : (
                      <span className="text-cream-faint">
                        {u.stripe_status ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-cream-muted whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <form action={setUserPlan} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="plan"
                        defaultValue={u.plan}
                        className="px-2 py-1 rounded-lg bg-ink ring-1 ring-line text-cream text-xs outline-none focus:ring-gold"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {planLabel(p)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-ink-4 text-cream text-xs hover:bg-ink-3"
                      >
                        Set
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-3">
                    {u.is_admin ? (
                      <form action={setUserAdmin}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="isAdmin" value="false" />
                        <button
                          type="submit"
                          disabled={u.id === currentAdminId}
                          className="px-2.5 py-1 rounded-lg bg-gold/15 text-gold ring-1 ring-gold/40 text-xs hover:bg-gold/25 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.id === currentAdminId ? "You" : "Revoke"}
                        </button>
                      </form>
                    ) : (
                      <form action={setUserAdmin}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="isAdmin" value="true" />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded-lg bg-ink-4 text-cream text-xs hover:bg-ink-3"
                        >
                          Make admin
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="px-5 py-3 text-xs text-cream-faint border-t border-line">
          Showing up to 100 most recent members. Plan changes here are manual
          overrides and do not affect Stripe billing.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
  small,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-5">
      <div className="text-xs uppercase tracking-wider text-cream-faint">
        {label}
      </div>
      <div
        className={`mt-2 font-display ${small ? "text-2xl" : "text-3xl"} ${
          warn ? "text-rose" : accent ? "text-gold" : "text-cream"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
