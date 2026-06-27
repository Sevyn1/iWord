import Link from "next/link";
import { notFound } from "next/navigation";
import { CHURCHES, getChurchBySlug, getPastorsByChurch } from "@/lib/churches";
import { getSermonsByPastor } from "@/lib/sermons";
import { SermonCard } from "@/components/SermonCard";
import { formatCount } from "@/lib/format";

export async function generateStaticParams() {
  return CHURCHES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const church = getChurchBySlug(slug);
  return { title: church ? `${church.name} — iWord` : "Church — iWord" };
}

/** Strip the scheme/trailing slash to show a friendly website label. */
function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export default async function ChurchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const church = getChurchBySlug(slug);
  if (!church) notFound();

  const pastors = getPastorsByChurch(church.id);
  const totalFollowers = pastors.reduce((sum, p) => sum + p.followers, 0);

  // Latest sermons across all of the church's pastors.
  const sermons = pastors
    .flatMap((p) => getSermonsByPastor(p.id))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 6);

  return (
    <div>
      {/* Themed header */}
      <section
        className="border-b border-line"
        style={{
          background: `linear-gradient(180deg, hsl(${church.hue},45%,18%) 0%, var(--ink) 100%)`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl flex items-center justify-center text-3xl font-semibold text-cream ring-2 ring-line shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(${church.hue},65%,38%), hsl(${(church.hue + 30) % 360},70%,22%))`,
            }}
          >
            {church.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">
              {church.denomination ? `${church.denomination} church` : "Church"}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl text-cream leading-tight mt-1">
              {church.name}
            </h1>
            <p className="text-cream-muted mt-1">
              {church.location}
              {church.founded ? ` · Est. ${church.founded}` : ""}
            </p>
            <p className="mt-3 text-cream-muted max-w-2xl">{church.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-cream-muted">
                {pastors.length} {pastors.length === 1 ? "pastor" : "pastors"} ·{" "}
                {formatCount(totalFollowers)} followers
              </span>
              {church.website && (
                <a
                  href={church.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gold hover:bg-gold-hot text-ink font-medium transition-colors"
                >
                  Visit website
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 17 17 7M17 7H9m8 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pastors at this church */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-display text-2xl text-cream mb-5">
          Pastors at {church.name}
        </h2>
        {pastors.length === 0 ? (
          <p className="text-cream-muted">No pastors listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastors.map((p) => (
              <Link
                key={p.id}
                href={`/pastors/${p.slug}`}
                className="flex items-center gap-4 rounded-2xl bg-ink-2 ring-1 ring-line p-4 hover:bg-ink-3 transition-colors"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold text-cream ring-1 ring-line shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-cream font-medium truncate">{p.name}</div>
                  <div className="text-cream-muted text-sm truncate">{p.title}</div>
                  <div className="text-cream-faint text-xs mt-0.5">
                    {formatCount(p.followers)} followers
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Latest sermons from the church */}
      {sermons.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
          <h2 className="font-display text-2xl text-cream mb-5">
            Latest from {church.name}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sermons.map((s, i) => (
              <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
