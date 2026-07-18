// One-off probe: extract likely brand colors from each church website by
// scanning meta theme-color, CSS custom properties (--brand/--primary/etc.),
// and the most frequent vivid hex colors in linked stylesheets.
import { URL } from "node:url";

const sites = {
  "Bethlehem Baptist Church": "https://www.desiringgod.org",
  "Grace Community Church": "https://www.gty.org",
  "Metropolitan Tabernacle": "https://www.metropolitantabernacle.org",
  "Parkside Church": "https://www.parksidechurch.com",
  "Redeemer Presbyterian Church": "https://www.redeemer.com",
  "Saint Andrew's Chapel": "https://www.saintandrewschapel.com",
  "The Village Church": "https://www.thevillagechurch.net",
};

function toHsl(input) {
  let r, g, b;
  const hex = input.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
  } else {
    const m = input.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (!m) return null; r = +m[1]; g = +m[2]; b = +m[3];
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  return { h, s: +s.toFixed(2), l: +l.toFixed(2) };
}

async function get(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 10000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "iWordBot/1.0" }, redirect: "follow", signal: c.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch { return ""; } finally { clearTimeout(t); }
}

for (const [name, url] of Object.entries(sites)) {
  const html = (await get(url)).slice(0, 400000);
  const candidates = [];
  const tc = html.match(/<meta[^>]+theme-color[^>]+content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]+theme-color/i);
  if (tc) candidates.push(["meta theme-color", tc[1]]);

  // Gather CSS: inline <style> + first few linked stylesheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 4);
  for (const href of links) {
    try { css += "\n" + (await get(new URL(href, url).href)).slice(0, 300000); } catch {}
  }

  // Brand-ish CSS custom properties.
  for (const m of css.matchAll(/--[a-z0-9-]*(?:brand|primary|accent|theme|main)[a-z0-9-]*\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/gi)) {
    candidates.push(["css var " + m[0].split(":")[0].trim(), m[1]]);
  }

  // Most frequent vivid hex in all CSS.
  const freq = new Map();
  for (const m of (html + css).matchAll(/#([0-9a-f]{6})\b/gi)) {
    const hsl = toHsl(m[1]);
    if (hsl && hsl.s >= 0.25 && hsl.l > 0.1 && hsl.l < 0.9) {
      const key = "#" + m[1].toLowerCase();
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  console.log("\n== " + name + " (" + url + ")");
  for (const [src, col] of candidates.slice(0, 6)) console.log("  " + src + " = " + col + " -> " + JSON.stringify(toHsl(col)));
  console.log("  top vivid hex:", top.map(([c, n]) => `${c}(${n}) h${toHsl(c)?.h}`).join(", ") || "(none)");
}
