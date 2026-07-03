import Link from "next/link";
import { notFound } from "next/navigation";
import { SERMONS, getRelated, getSermonBySlug } from "@/lib/sermons";
import { getPastorById } from "@/lib/pastors";
import { getChurchForPastor } from "@/lib/churches";
import { getCurrentAccount, isPaidPlan } from "@/lib/account";
import { isFollowingPastor } from "@/lib/follows";
import { Thumbnail } from "@/components/Thumbnail";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FollowButton } from "@/components/FollowButton";
import { SermonCard } from "@/components/SermonCard";
import { formatDurationLong, formatCount, formatRelative } from "@/lib/format";

export async function generateStaticParams() {
  return SERMONS.map((s) => ({ id: s.slug }));
}

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sermon = getSermonBySlug(id);
  if (!sermon) notFound();
  const pastor = getPastorById(sermon.pastorId);
  const church = pastor ? getChurchForPastor(pastor) : undefined;
  const related = getRelated(sermon, 4);
  const account = await getCurrentAccount();
  const canUseExcerpt = isPaidPlan(account?.plan);
  const following = pastor ? await isFollowingPastor(pastor.id) : false;

  return (
    <article className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <nav className="text-xs text-cream-faint mb-6">
        <Link href="/sermons" className="hover:text-cream">Sermons</Link>
        <span className="mx-2">/</span>
        <span>{sermon.title}</span>
      </nav>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
        <Thumbnail title={sermon.title} hue={sermon.hue} label={sermon.scripture} size="lg" />
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-cream leading-tight">
            {sermon.title}
          </h1>
          {pastor && (
            <div className="mt-4 flex items-center gap-3">
              <Link
                href={`/pastors/${pastor.slug}`}
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-cream ring-1 ring-line"
                style={{
                  background: `linear-gradient(135deg, hsl(${pastor.hue},60%,32%), hsl(${(pastor.hue + 30) % 360},65%,18%))`,
                }}
                aria-label={pastor.name}
              >
                {pastor.initials}
              </Link>
              <div>
                <Link href={`/pastors/${pastor.slug}`} className="text-cream font-medium hover:text-gold">
                  {pastor.name}
                </Link>
                <div className="text-xs text-cream-muted">
                  {church ? (
                    <Link href={`/churches/${church.slug}`} className="hover:text-gold underline-offset-2 hover:underline">
                      {pastor.church}
                    </Link>
                  ) : (
                    pastor.church
                  )}{" "}
                  · {pastor.location}
                </div>
              </div>
              <div className="ml-auto">
                <FollowButton pastorId={pastor.id} initialFollowing={following} size="sm" />
              </div>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <Meta label="Scripture" value={sermon.scripture} />
            <Meta label="Length" value={formatDurationLong(sermon.durationSec)} />
            <Meta label="Topic" value={sermon.topic} />
          </dl>

          <div className="mt-6">
            <AudioPlayer sermon={sermon} />
          </div>
        </div>
      </div>

      <section className="mt-10 grid lg:grid-cols-[1.1fr_1fr] gap-10">
        <div>
          <h2 className="font-display text-xl text-cream mb-2">About this sermon</h2>
          <p className="text-cream-muted leading-relaxed">{sermon.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {sermon.tags.map((t) => (
              <Link
                key={t}
                href={`/sermons?q=${encodeURIComponent(t)}`}
                className="text-xs px-2.5 py-1 rounded-full bg-ink-3 text-cream-muted hover:text-cream hover:bg-ink-4"
              >
                #{t}
              </Link>
            ))}
          </div>

          <div className="mt-6 text-xs text-cream-faint">
            {formatCount(sermon.viewsThisWeek)} listens this week · published {formatRelative(sermon.publishedAt)}
          </div>
        </div>

        <aside className="rounded-2xl bg-ink-2 ring-1 ring-line p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-cream text-lg">60‑second excerpt</h3>
            {!canUseExcerpt && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
                Devoted
              </span>
            )}
          </div>
          <p className="text-sm text-cream-muted mt-1">
            A short, shareable highlight from this sermon — auto‑generated by iWord&rsquo;s AI.
          </p>
          {canUseExcerpt ? (
            <>
              <button
                type="button"
                className="mt-4 w-full px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
              >
                Generate &amp; share excerpt
              </button>
              <p className="mt-2 text-[11px] text-cream-faint">
                Excerpt generation will be wired to Whisper + GPT in the next milestone.
              </p>
            </>
          ) : (
            <>
              <Link
                href="/pricing"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-ink-4 text-cream font-medium hover:bg-line transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                Unlock with Devoted
              </Link>
              <p className="mt-2 text-[11px] text-cream-faint">
                Shareable AI excerpts are included with Devoted and Patron plans.
              </p>
            </>
          )}
        </aside>
      </section>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl text-cream mb-5">More like this</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((s) => (
              <SermonCard key={s.id} sermon={s} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-2 ring-1 ring-line px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.15em] text-cream-faint">{label}</dt>
      <dd className="text-cream truncate">{value}</dd>
    </div>
  );
}
