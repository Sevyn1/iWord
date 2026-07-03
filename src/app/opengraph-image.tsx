import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
          color: "#F7F3EA",
          background:
            "radial-gradient(1000px 600px at 100% 0%, rgba(176,125,40,0.35), transparent 60%), linear-gradient(135deg, #1B2138 0%, #0E1220 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 36 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #C68F35, #8F6417)",
            }}
          >
            i
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 940 }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ fontSize: 32, color: "#B9BACB", marginTop: 30, maxWidth: 860 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size }
  );
}
