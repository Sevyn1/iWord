import Link from "next/link";
import { notFound } from "next/navigation";
import { PASTORS, getPastorBySlug } from "@/lib/pastors";
import { getSermonsByPastor } from "@/lib/sermons";
import { SermonCard } from "@/components/SermonCard";
import { FollowButton } from "@/components/FollowButton";
import { isFollowingPastor } from "@/lib/follows";
import { getCurrentAccount } from "@/lib/account";
import { getChurchForPastor } from "@/lib/churches";
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
  const account = await getCurrentAccount();
  const isPatron = account?.plan === "patron";
  const church = getChurchForPastor(pastor);
  // A pastor inherits their church's colour identity so the two pages match.
  const hue = church?.hue ?? pastor.hue;

  return (
    <div>
      {/* Header — themed by the pastor's church */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `radial-gradient(90% 130% at 100% 0%, hsl(${(hue + 35) % 360} 64% 44% / 0.65), transparent 70%), linear-gradient(165deg, hsl(${hue} 56% 32%) 0%, hsl(${hue} 52% 19%) 100%)`,
        }}
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-3xl font-semibold text-white ring-2 ring-white/25 shrink-0 shadow-xl shadow-black/40"
            style={{
              background: `linear-gradient(135deg, hsl(${hue},68%,52%), hsl(${(hue + 30) % 360},72%,30%))`,
            }}
          >
            {pastor.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[#EBC67A]">{pastor.title}</p>
            <h1 className="font-display text-3xl sm:text-5xl text-white leading-tight mt-1">
              {pastor.name}
            </h1>
            <p className="text-white/75 mt-1">
              {church ? (
                <Link
                  href={`/churches/${church.slug}`}
                  className="inline-flex items-center gap-1.5 text-white hover:text-white/80 underline-offset-2 hover:underline transition-colors"
                >
                  <span
                    className="w-4 h-4 rounded-[5px] shrink-0 ring-1 ring-white/30"
                    style={{
                      background: `linear-gradient(135deg, hsl(${church.hue},68%,52%), hsl(${(church.hue + 30) % 360},72%,30%))`,
                    }}
                    aria-hidden="true"
                  />
                  {pastor.church}
                </Link>
              ) : (
                pastor.church
              )}{" "}
              · {pastor.location}
            </p>
            <p className="mt-3 text-white/80 max-w-2xl">{pastor.bio}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 ring-1 ring-white/15 px-3.5 py-1.5 text-sm text-white">
                <span className="font-semibold">{formatCount(pastor.followers)}</span>
                <span className="text-white/70">followers</span>
              </span>
              <FollowButton pastorId={pastor.id} initialFollowing={following} />
              {isPatron ? (
                following && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 text-[#EBC67A] ring-1 ring-white/25 font-medium">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="m12 3 2.6 5.27 5.82.85-4.21 4.1 1 5.8L12 16.9l-5.2 2.73 1-5.8-4.2-4.1 5.8-.85L12 3Z" />
                    </svg>
                    You support {pastor.name.split(" ").slice(-1)[0]}
                  </span>
                )
              ) : (
                <Link
                  href="/pricing#patron"
                  className="px-4 py-2 rounded-full bg-white text-[#1B2138] font-medium hover:bg-white/90 transition-colors"
                >
                  Support as a patron
                </Link>
              )}
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
