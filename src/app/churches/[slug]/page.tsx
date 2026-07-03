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
        className="relative border-b border-line overflow-hidden"
        style={{
          background: `radial-gradient(90% 130% at 100% 0%, hsl(${(church.hue + 35) % 360} 62% 32% / 0.55), transparent 70%), linear-gradient(165deg, hsl(${church.hue} 52% 24%) 0%, hsl(${church.hue} 44% 15%) 55%, var(--ink) 100%)`,
        }}
      >
        {/* decorative motif */}
        <svg
          className="absolute -right-8 -top-8 opacity-[0.07] pointer-events-none"
          width="280" height="280" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <path d="M12 2v20M5 9h14M8 22h8" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <Link
            href="/churches"
            className="inline-flex items-center gap-1.5 text-sm text-cream-muted hover:text-cream transition-colors mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All churches
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            <div
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl flex items-center justify-center text-3xl font-semibold text-cream ring-2 ring-line shrink-0 shadow-xl shadow-black/40"
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
              <p className="text-cream-muted mt-1 flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
                  <path d="M12 21s-7-5.686-7-11a7 7 0 1114 0c0 5.314-7 11-7 11z" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                {church.location}
                {church.founded ? ` · Est. ${church.founded}` : ""}
              </p>
              <p className="mt-3 text-cream-muted max-w-2xl">{church.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 ring-1 ring-white/10 px-3.5 py-1.5 text-sm text-cream">
                  <span className="font-semibold">{pastors.length}</span>
                  <span className="text-cream-muted">{pastors.length === 1 ? "pastor" : "pastors"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 ring-1 ring-white/10 px-3.5 py-1.5 text-sm text-cream">
                  <span className="font-semibold">{formatCount(totalFollowers)}</span>
                  <span className="text-cream-muted">followers</span>
                </span>
                {church.website && (
                  <a
                    href={church.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gold hover:bg-gold-hot text-ink font-medium transition-colors"
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
                className="group flex items-center gap-4 rounded-2xl bg-ink-2 ring-1 ring-line p-4 hover:ring-gold/40 hover:bg-ink-3 transition-all"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold text-cream ring-1 ring-line shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {p.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-cream font-medium truncate group-hover:text-gold transition-colors">{p.name}</div>
                  <div className="text-cream-muted text-sm truncate">{p.title}</div>
                  <div className="text-cream-faint text-xs mt-0.5">
                    {formatCount(p.followers)} followers
                  </div>
                </div>
                <svg
                  className="text-cream-faint group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0"
                  width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
