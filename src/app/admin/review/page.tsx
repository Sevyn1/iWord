import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveSermon, rejectSermon, approveAllFromFeed } from "./actions";

export const metadata = { title: "Review queue · Admin" };

type DraftRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  topic: string | null;
  published_at: string;
  duration_sec: number;
  feed_url: string | null;
  content_type: string | null;
  ingested_at: string | null;
  pastor: { name: string; church: string | null } | null;
};

export default async function AdminReviewPage() {
  await requireAdmin();

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="font-display text-3xl text-cream">Review queue</h1>
        <p className="mt-4 text-cream-muted">
          The service-role key isn&apos;t configured, so the review queue is
          unavailable. Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable it.
        </p>
      </div>
    );
  }

  const { data } = await admin
    .from("sermons")
    .select(
      "id, slug, title, summary, topic, published_at, duration_sec, feed_url, content_type, ingested_at, pastor:pastors(name, church)"
    )
    .eq("is_published", false)
    .order("ingested_at", { ascending: false, nullsFirst: false })
    .limit(200);
  const drafts = (data ?? []) as unknown as DraftRow[];

  // Group drafts by feed so a vetted source can be approved in one click.
  const byFeed = new Map<string, DraftRow[]>();
  for (const d of drafts) {
    const key = d.feed_url ?? "manual";
    byFeed.set(key, [...(byFeed.get(key) ?? []), d]);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-1">Admin</p>
          <h1 className="font-display text-3xl text-cream">Review queue</h1>
        </div>
        <Link href="/admin" className="text-sm text-cream-muted hover:text-cream">
          ← Dashboard
        </Link>
      </div>

      <p className="mt-3 text-sm text-cream-muted max-w-2xl">
        New episodes from untrusted feeds land here as drafts — invisible to
        listeners until approved. Mark a feed as auto-publish on the{" "}
        <Link href="/admin/feeds" className="text-gold hover:underline underline-offset-2">
          feeds page
        </Link>{" "}
        to skip review for a vetted source.
      </p>

      {drafts.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-ink-2 ring-1 ring-line p-10 text-center text-cream-muted">
          Nothing waiting for review. New drafts will appear here after the next
          ingestion run.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {[...byFeed.entries()].map(([feedUrl, items]) => (
            <div
              key={feedUrl}
              className="rounded-2xl bg-ink-2 ring-1 ring-line overflow-hidden"
            >
              <div className="p-5 border-b border-line flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="font-display text-lg text-cream truncate">
                    {items[0].pastor?.church || items[0].pastor?.name || "Unknown source"}
                  </h2>
                  <p className="text-xs text-cream-faint truncate">{feedUrl}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-cream-muted">
                    {items.length} pending
                  </span>
                  {feedUrl !== "manual" && (
                    <form action={approveAllFromFeed}>
                      <input type="hidden" name="feedUrl" value={feedUrl} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-full bg-leaf/15 text-leaf ring-1 ring-leaf/40 text-xs font-medium hover:bg-leaf/25"
                      >
                        Approve all
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <ul className="divide-y divide-line">
                {items.map((d) => (
                  <li key={d.id} className="p-5 flex gap-4 items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-cream font-medium">{d.title}</span>
                        {d.content_type === "podcast" && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose/15 text-rose ring-1 ring-rose/30">
                            Podcast
                          </span>
                        )}
                        {d.topic && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-ink-4 text-cream-faint">
                            {d.topic}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-cream-muted line-clamp-2">
                        {d.summary || "No summary."}
                      </p>
                      <p className="mt-1 text-xs text-cream-faint">
                        {d.pastor?.name ?? "Unknown pastor"} · published{" "}
                        {new Date(d.published_at).toLocaleDateString()}
                        {d.duration_sec > 0 &&
                          ` · ${Math.round(d.duration_sec / 60)} min`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <form action={approveSermon}>
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-full bg-leaf/15 text-leaf ring-1 ring-leaf/40 text-xs font-medium hover:bg-leaf/25"
                        >
                          Approve
                        </button>
                      </form>
                      <form action={rejectSermon}>
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-full bg-rose/10 text-rose ring-1 ring-rose/30 text-xs font-medium hover:bg-rose/20"
                        >
                          Discard
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
