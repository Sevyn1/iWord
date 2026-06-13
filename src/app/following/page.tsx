import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowedPastorIds } from "@/lib/follows";
import { getRecentSermonIds } from "@/lib/listens";
import { PASTORS } from "@/lib/pastors";
import { SERMONS, getSermonById } from "@/lib/sermons";
import { SermonCard } from "@/components/SermonCard";

export const metadata = { title: "Following — iWord" };

export default async function FollowingPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/account");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/following");

  const followedIds = await getFollowedPastorIds();
  const followed = PASTORS.filter((p) => followedIds.has(p.id));

  // Latest sermons from the pastors the user follows, newest first.
  const feed = [...SERMONS]
    .filter((s) => followedIds.has(s.pastorId))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

  // Continue listening — the user's recently played sermons.
  const recentIds = await getRecentSermonIds(4);
  const recent = recentIds
    .map((id) => getSermonById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-cream">Following</h1>
        <p className="text-cream-muted mt-1">
          The latest messages from the pastors you follow.
        </p>
      </header>

      {/* Empty state — no follows yet */}
      {followed.length === 0 ? (
        <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-10 text-center">
          <p className="text-cream-muted max-w-md mx-auto">
            You aren&rsquo;t following anyone yet. Open a pastor&rsquo;s page and tap{" "}
            <span className="text-gold">Follow</span> to gather their new messages
            here.
          </p>
          <Link
            href="/sermons"
            className="mt-5 inline-flex items-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
          >
            Browse sermons
          </Link>
        </div>
      ) : (
        <>
          {/* Following avatars */}
          <section className="mb-10">
            <div className="flex flex-wrap gap-3">
              {followed.map((p) => (
                <Link
                  key={p.id}
                  href={`/pastors/${p.slug}`}
                  className="flex items-center gap-2.5 rounded-full bg-ink-2 ring-1 ring-line pl-1.5 pr-4 py-1.5 hover:bg-ink-3 transition-colors"
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-cream ring-1 ring-line shrink-0"
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
          </section>

          {/* Continue listening */}
          {recent.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl text-cream">
                  Continue listening
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recent.map((s, i) => (
                  <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
                ))}
              </div>
            </section>
          )}

          {/* Latest from followed pastors */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl text-cream">
                Latest from your pastors
              </h2>
              <Link
                href="/sermons"
                className="text-sm text-cream-muted hover:text-cream"
              >
                Browse all →
              </Link>
            </div>
            {feed.length === 0 ? (
              <p className="text-cream-muted">
                No messages from the pastors you follow yet. Check back soon.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {feed.map((s, i) => (
                  <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
