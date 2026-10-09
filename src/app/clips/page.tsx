import type { Metadata } from "next";
import { getClips } from "@/lib/content";
import { ClipsFeed } from "@/components/ClipsFeed";

export const metadata: Metadata = {
  title: "Clips — Daily Bread",
  description:
    "Swipe through 60-second sermon moments — the most powerful minutes from pulpits around the world, one clip at a time.",
};

// The feed is shuffled per request; don't cache a single order.
export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const clips = await getClips(60);

  if (clips.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl text-cream">No clips yet</h1>
        <p className="mt-3 text-cream-muted">
          Clips appear as our AI works through the catalog — check back soon.
        </p>
      </div>
    );
  }

  return <ClipsFeed clips={clips} />;
}
