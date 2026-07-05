import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoveryProvider } from "@/lib/ingestion/discovery";
import { isOpenAIConfigured } from "@/lib/ingestion/enrich";
import { addFeed, deleteFeed, discoverNow, scanNow, setFeedActive } from "./actions";

export const metadata = { title: "Feeds · Admin" };
// A manual "Scan now" runs the full ingestion pass inside this route.
export const maxDuration = 60;

type FeedRow = {
  id: string;
  kind: string;
  url: string;
  title: string | null;
  active: boolean;
  last_scanned_at: string | null;
  last_status: string | null;
  created_at: string;
};

export default async function AdminFeedsPage() {
  await requireAdmin();

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="font-display text-3xl text-cream">Feeds</h1>
        <p className="mt-4 text-cream-muted">
          The service-role key isn&apos;t configured, so feed management is
          unavailable. Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable it.
        </p>
      </div>
    );
  }

  const { data } = await admin
    .from("feeds")
    .select("id, kind, url, title, active, last_scanned_at, last_status, created_at")
    .order("created_at", { ascending: false });
  const feeds = (data ?? []) as FeedRow[];

  const discoveryOn = true;
  const provider = discoveryProvider();
  const aiOn = isOpenAIConfigured();
  const activeCount = feeds.filter((f) => f.active).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-1">Admin</p>
          <h1 className="font-display text-3xl text-cream">Content feeds</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-cream-muted hover:text-cream">
            ← Dashboard
          </Link>
          <form action={scanNow}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-gold text-ink font-medium text-sm hover:bg-gold-hot transition-colors"
            >
              Scan now
            </button>
          </form>
        </div>
      </div>

      <p className="mt-3 text-sm text-cream-muted max-w-2xl">
        Podcast/RSS feeds are scanned daily and any new episodes are added
        automatically. Adding a feed here ingests it right away. Removing a feed
        stops future scans but leaves already-imported content in place.
      </p>

      {/* Capability banner */}
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Pill on={aiOn} label={aiOn ? "AI enrichment on" : "AI enrichment off (heuristic mode)"} />
        <Pill on={discoveryOn} label={`Discovery: ${provider}`} />
        <span className="px-2.5 py-1 rounded-full bg-ink-3 ring-1 ring-line text-cream-muted">
          {activeCount} active · {feeds.length} total
        </span>
      </div>

      {/* Add + discover forms */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <form
          action={addFeed}
          className="rounded-2xl bg-ink-2 ring-1 ring-line p-5"
        >
          <h2 className="font-display text-lg text-cream">Add a feed</h2>
          <p className="text-xs text-cream-faint mt-1">
            Paste a podcast RSS feed URL.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              name="url"
              required
              placeholder="https://example.com/podcast.rss"
              className="flex-1 px-3 py-2 rounded-lg bg-ink ring-1 ring-line focus:ring-gold outline-none text-sm text-cream placeholder:text-cream-faint"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-ink-4 text-cream text-sm hover:bg-ink-3 whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </form>

        <form
          action={discoverNow}
          className={`rounded-2xl bg-ink-2 ring-1 ring-line p-5 ${discoveryOn ? "" : "opacity-60"}`}
        >
          <h2 className="font-display text-lg text-cream">Discover feeds</h2>
          <p className="text-xs text-cream-faint mt-1">
            Search {provider} and add matches to the scan list.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              name="term"
              disabled={!discoveryOn}
              placeholder="e.g. sermon, gospel, grace church"
              className="flex-1 px-3 py-2 rounded-lg bg-ink ring-1 ring-line focus:ring-gold outline-none text-sm text-cream placeholder:text-cream-faint disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!discoveryOn}
              className="px-3 py-2 rounded-lg bg-ink-4 text-cream text-sm hover:bg-ink-3 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Find
            </button>
          </div>
        </form>
      </div>

      {/* Feeds table */}
      <div className="mt-8 rounded-2xl bg-ink-2 ring-1 ring-line overflow-hidden">
        <div className="p-5 border-b border-line">
          <h2 className="font-display text-xl text-cream">Sources</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-cream-faint text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Feed</th>
                <th className="px-5 py-3 font-medium">Last scan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Active</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {feeds.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-cream-muted">
                    No feeds yet. Add a podcast RSS URL above to start ingesting.
                  </td>
                </tr>
              )}
              {feeds.map((f) => (
                <tr key={f.id} className="border-t border-line align-middle">
                  <td className="px-5 py-3 max-w-[22rem]">
                    <div className="text-cream font-medium truncate">
                      {f.title || f.url}
                    </div>
                    <div className="text-cream-faint text-xs truncate">{f.url}</div>
                  </td>
                  <td className="px-5 py-3 text-cream-muted whitespace-nowrap">
                    {f.last_scanned_at
                      ? new Date(f.last_scanned_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        f.last_status?.startsWith("error")
                          ? "text-rose"
                          : "text-cream-muted"
                      }
                    >
                      {f.last_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <form action={setFeedActive}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="active" value={(!f.active).toString()} />
                      <button
                        type="submit"
                        className={
                          f.active
                            ? "px-2.5 py-1 rounded-lg bg-leaf/15 text-leaf ring-1 ring-leaf/40 text-xs hover:bg-leaf/25"
                            : "px-2.5 py-1 rounded-lg bg-ink-4 text-cream-muted text-xs hover:bg-ink-3"
                        }
                      >
                        {f.active ? "Active" : "Paused"}
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-3">
                    <form action={deleteFeed}>
                      <input type="hidden" name="id" value={f.id} />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-rose/10 text-rose ring-1 ring-rose/30 text-xs hover:bg-rose/20"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={
        on
          ? "px-2.5 py-1 rounded-full bg-leaf/15 text-leaf ring-1 ring-leaf/30"
          : "px-2.5 py-1 rounded-full bg-ink-3 ring-1 ring-line text-cream-faint"
      }
    >
      {label}
    </span>
  );
}
