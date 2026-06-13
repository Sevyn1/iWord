import Link from "next/link";
import { notFound } from "next/navigation";
import { PASTORS, getPastorBySlug } from "@/lib/pastors";
import { getSermonsByPastor } from "@/lib/sermons";
import { SermonCard } from "@/components/SermonCard";
import { FollowButton } from "@/components/FollowButton";
import { isFollowingPastor } from "@/lib/follows";
import { formatCount } from "@/lib/format";

export async function generateStaticParams() {
  return PASTORS.map((p) => ({ slug: p.slug }));
}

export default async function PastorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pastor = getPastorBySlug(slug);
  if (!pastor) notFound();
  const sermons = getSermonsByPastor(pastor.id).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const following = await isFollowingPastor(pastor.id);

  return (
    <div>
      {/* Header */}
      <section
        className="border-b border-line"
        style={{
          background: `linear-gradient(180deg, hsl(${pastor.hue},45%,18%) 0%, var(--ink) 100%)`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-3xl font-semibold text-cream ring-2 ring-line shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(${pastor.hue},65%,38%), hsl(${(pastor.hue + 30) % 360},70%,22%))`,
            }}
          >
            {pastor.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{pastor.title}</p>
            <h1 className="font-display text-3xl sm:text-5xl text-cream leading-tight mt-1">
              {pastor.name}
            </h1>
            <p className="text-cream-muted mt-1">
              {pastor.church} · {pastor.location}
            </p>
            <p className="mt-3 text-cream-muted max-w-2xl">{pastor.bio}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-cream-muted">
                {formatCount(pastor.followers)} followers
              </span>
              <FollowButton pastorId={pastor.id} initialFollowing={following} />
              <Link
                href="/pricing#patron"
                className="px-4 py-2 rounded-full bg-gold hover:bg-gold-hot text-ink font-medium transition-colors"
              >
                Support as a patron
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-display text-2xl text-cream mb-5">
          Sermons by {pastor.name.split(" ")[0]}
        </h2>
        {sermons.length === 0 ? (
          <p className="text-cream-muted">No sermons yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sermons.map((s) => (
              <SermonCard key={s.id} sermon={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
