import { ImageResponse } from "next/og";
import { getPastorBySlug } from "@/lib/content";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `A pastor on ${SITE_NAME}`;

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pastor = await getPastorBySlug(slug);
  const hue = pastor?.hue ?? 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#F7F3EA",
          background: `radial-gradient(900px 560px at 100% 0%, hsla(${hue}, 60%, 45%, 0.45), transparent 60%), linear-gradient(135deg, hsl(${hue}, 40%, 20%) 0%, #0E1220 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #C68F35, #8F6417)",
            }}
          >
            i
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 76,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              background: `linear-gradient(135deg, hsl(${hue}, 55%, 48%), hsl(${hue}, 50%, 30%))`,
            }}
          >
            {pastor?.initials ?? "iW"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, maxWidth: 780 }}>
              {pastor?.name ?? "Pastor not found"}
            </div>
            {pastor ? (
              <div style={{ fontSize: 32, color: "#C9CBDA", marginTop: 22, maxWidth: 780 }}>
                {pastor.title} · {pastor.church}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
