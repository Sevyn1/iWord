import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reject private / loopback / link-local hosts to limit SSRF surface.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

/**
 * Same-origin image proxy used only to let the client analyse a logo's pixels
 * (cross-origin logos taint the canvas and block luminance detection). Streams
 * the remote image back through our origin so getImageData() can read it.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return new Response("bad scheme", { status: 400 });
  }
  if (isBlockedHost(u.hostname)) {
    return new Response("blocked host", { status: 400 });
  }

  try {
    const upstream = await fetch(u.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (iWord logo probe)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return new Response("upstream error", { status: 502 });

    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return new Response("not an image", { status: 415 });
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
