import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Weekly digest — personalized sermon email.
 *
 * Members get sections built from what they follow and listen to, plus the
 * week's trending and newest uploads (each with its AI write-up); anonymous
 * homepage subscribers get the trending edition. Sent via Resend from the
 * /api/cron/digest schedule. Degrades gracefully: without RESEND_API_KEY and
 * RESEND_FROM the send is skipped cleanly (mirroring the catalog-fallback
 * pattern), and without Supabase it is a no-op.
 */

type DigestSermon = {
  slug: string;
  title: string;
  summary: string;
  pastorName: string;
  church: string;
  pastorId: string;
  publishedAt: string;
};

type DigestSection = { heading: string; blurb?: string; sermons: DigestSermon[] };

type Recipient = {
  email: string;
  token: string;
  userId: string | null;
};

const DIGEST_SELECT =
  "id, slug, title, summary, published_at, pastor_id, views_this_week, pastor:pastors(name, church)";

type DigestRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  published_at: string | null;
  pastor_id: string | null;
  views_this_week: number | null;
  pastor: { name: string | null; church: string | null } | null;
};

function mapRow(r: DigestRow): DigestSermon {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary ?? "",
    pastorName: r.pastor?.name ?? "",
    church: r.pastor?.church ?? "",
    pastorId: r.pastor_id ?? "",
    publishedAt: r.published_at ?? "",
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DigestSendResult = {
  ok: boolean;
  skipped?: string;
  recipients?: number;
  sent?: number;
  failed?: number;
};

/** Build and send this week's digest to every active recipient. */
export async function sendWeeklyDigest(options?: {
  timeBudgetMs?: number;
  /** Cap recipients (manual/test runs). */
  limit?: number;
  /** Send only to this email (test runs). */
  onlyEmail?: string;
}): Promise<DigestSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: true, skipped: "RESEND_API_KEY / RESEND_FROM not configured" };
  }
  const db = createAdminClient();
  if (!db) return { ok: true, skipped: "Supabase not configured" };

  const startedAt = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? 240_000;
  const sinceIso = new Date(Date.now() - WEEK_MS).toISOString();

  // ── shared content (computed once) ─────────────────────────────────────────
  const [{ data: trendingRows }, { data: newRows }] = await Promise.all([
    db
      .from("sermons")
      .select(DIGEST_SELECT)
      .eq("is_published", true)
      .order("views_this_week", { ascending: false })
      .limit(5),
    db
      .from("sermons")
      .select(DIGEST_SELECT)
      .eq("is_published", true)
      .gte("published_at", sinceIso)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);
  const trending = ((trendingRows ?? []) as unknown as DigestRow[]).map(mapRow);
  const fresh = ((newRows ?? []) as unknown as DigestRow[]).map(mapRow);
  if (trending.length === 0 && fresh.length === 0) {
    return { ok: true, skipped: "no content to send" };
  }

  // ── recipients ──────────────────────────────────────────────────────────────
  const recipients = await collectRecipients(db, options?.onlyEmail);
  const capped = options?.limit ? recipients.slice(0, options.limit) : recipients;
  if (capped.length === 0) return { ok: true, recipients: 0, sent: 0, failed: 0 };

  // ── personalization data, batched across all member recipients ────────────
  const userIds = capped.filter((r) => r.userId).map((r) => r.userId as string);
  const { followsByUser, listenedPastorsByUser } = await loadSignals(db, userIds);

  // New sermons this week from any pastor someone follows or listens to —
  // one query, then grouped per user.
  const signalPastorIds = Array.from(
    new Set([...followsByUser.values(), ...listenedPastorsByUser.values()].flatMap((s) => [...s]))
  );
  let weeklyByPastor = new Map<string, DigestSermon[]>();
  if (signalPastorIds.length > 0) {
    const { data } = await db
      .from("sermons")
      .select(DIGEST_SELECT)
      .eq("is_published", true)
      .gte("published_at", sinceIso)
      .in("pastor_id", signalPastorIds)
      .order("published_at", { ascending: false });
    weeklyByPastor = groupByPastor(((data ?? []) as unknown as DigestRow[]).map(mapRow));
  }

  // ── send ────────────────────────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  for (const recipient of capped) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    const sections = buildSections(recipient, {
      trending,
      fresh,
      follows: recipient.userId ? followsByUser.get(recipient.userId) : undefined,
      listenedPastors: recipient.userId ? listenedPastorsByUser.get(recipient.userId) : undefined,
      weeklyByPastor,
    });
    const html = renderDigestHtml(sections, unsubscribeUrl(recipient.token));
    const ok = await sendEmail(apiKey, {
      from,
      to: recipient.email,
      subject: `Your week in sermons — ${SITE_NAME}`,
      html,
    });
    if (ok) sent += 1;
    else failed += 1;
  }

  return { ok: true, recipients: capped.length, sent, failed };
}

// ── recipients ────────────────────────────────────────────────────────────────

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

async function collectRecipients(db: AdminDb, onlyEmail?: string): Promise<Recipient[]> {
  // Ensure every member has a subscriber row (gives them an unsubscribe token).
  const { data: profiles } = await db
    .from("profiles")
    .select("id, email")
    .not("email", "is", null);
  const members = (profiles ?? []).filter((p) => p.email) as { id: string; email: string }[];
  if (members.length > 0) {
    await db.from("newsletter_subscribers").upsert(
      members.map((m) => ({ email: m.email.toLowerCase(), user_id: m.id })),
      { onConflict: "email", ignoreDuplicates: true }
    );
  }

  let query = db
    .from("newsletter_subscribers")
    .select("email, token, user_id")
    .is("unsubscribed_at", null);
  if (onlyEmail) query = query.eq("email", onlyEmail.toLowerCase());
  const { data: subs } = await query;
  return ((subs ?? []) as { email: string; token: string; user_id: string | null }[]).map((s) => ({
    email: s.email,
    token: s.token,
    userId: s.user_id,
  }));
}

// ── personalization signals ───────────────────────────────────────────────────

async function loadSignals(db: AdminDb, userIds: string[]) {
  const followsByUser = new Map<string, Set<string>>();
  const listenedPastorsByUser = new Map<string, Set<string>>();
  if (userIds.length === 0) return { followsByUser, listenedPastorsByUser };

  const monthAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: follows }, { data: listens }] = await Promise.all([
    db.from("follows").select("user_id, pastor_id").in("user_id", userIds),
    db
      .from("listens")
      .select("user_id, sermon_id, sermons(pastor_id)")
      .in("user_id", userIds)
      .gte("listened_at", monthAgoIso),
  ]);

  for (const f of (follows ?? []) as { user_id: string; pastor_id: string }[]) {
    if (!followsByUser.has(f.user_id)) followsByUser.set(f.user_id, new Set());
    followsByUser.get(f.user_id)!.add(f.pastor_id);
  }
  for (const l of (listens ?? []) as unknown as {
    user_id: string;
    sermons: { pastor_id: string | null } | null;
  }[]) {
    const pastorId = l.sermons?.pastor_id;
    if (!pastorId) continue;
    if (!listenedPastorsByUser.has(l.user_id)) listenedPastorsByUser.set(l.user_id, new Set());
    listenedPastorsByUser.get(l.user_id)!.add(pastorId);
  }
  return { followsByUser, listenedPastorsByUser };
}

function groupByPastor(sermons: DigestSermon[]): Map<string, DigestSermon[]> {
  const map = new Map<string, DigestSermon[]>();
  for (const s of sermons) {
    if (!map.has(s.pastorId)) map.set(s.pastorId, []);
    map.get(s.pastorId)!.push(s);
  }
  return map;
}

// ── section assembly ──────────────────────────────────────────────────────────

function buildSections(
  recipient: Recipient,
  data: {
    trending: DigestSermon[];
    fresh: DigestSermon[];
    follows?: Set<string>;
    listenedPastors?: Set<string>;
    weeklyByPastor: Map<string, DigestSermon[]>;
  }
): DigestSection[] {
  const sections: DigestSection[] = [];
  const used = new Set<string>();
  const take = (list: DigestSermon[], max: number) => {
    const out: DigestSermon[] = [];
    for (const s of list) {
      if (used.has(s.slug)) continue;
      used.add(s.slug);
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  };

  if (data.follows && data.follows.size > 0) {
    const fromFollows = [...data.follows].flatMap((p) => data.weeklyByPastor.get(p) ?? []);
    const picked = take(sortNewest(fromFollows), 4);
    if (picked.length > 0) {
      sections.push({
        heading: "New from pastors you follow",
        blurb: "Fresh this week from the pulpits you keep close.",
        sermons: picked,
      });
    }
  }

  if (data.listenedPastors && data.listenedPastors.size > 0) {
    const fromListens = [...data.listenedPastors].flatMap((p) => data.weeklyByPastor.get(p) ?? []);
    const picked = take(sortNewest(fromListens), 3);
    if (picked.length > 0) {
      sections.push({
        heading: "Because you've been listening",
        blurb: "More from voices you've spent time with recently.",
        sermons: picked,
      });
    }
  }

  const trendingPicked = take(data.trending, 5);
  if (trendingPicked.length > 0) {
    sections.push({
      heading: "Trending this week",
      blurb: "What the iWord community is listening to right now.",
      sermons: trendingPicked,
    });
  }

  const freshPicked = take(data.fresh, 4);
  if (freshPicked.length > 0) {
    sections.push({
      heading: "New in the library",
      sermons: freshPicked,
    });
  }

  return sections;
}

function sortNewest(sermons: DigestSermon[]): DigestSermon[] {
  return [...sermons].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

// ── rendering ─────────────────────────────────────────────────────────────────

function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max = 220): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function renderDigestHtml(sections: DigestSection[], unsubUrl: string): string {
  const sectionHtml = sections
    .map(
      (sec) => `
      <tr><td style="padding:28px 0 4px 0;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#B5853A;font-weight:600;">${esc(sec.heading)}</div>
        ${sec.blurb ? `<div style="font-size:13px;color:#8a8273;margin-top:4px;">${esc(sec.blurb)}</div>` : ""}
      </td></tr>
      ${sec.sermons
        .map(
          (s) => `
      <tr><td style="padding:10px 0;">
        <div style="border:1px solid #e7dfcd;border-radius:12px;padding:16px 18px;background:#fffdf8;">
          <a href="${SITE_URL}/sermons/${encodeURIComponent(s.slug)}" style="font-size:16px;color:#1B2138;font-weight:600;text-decoration:none;">${esc(s.title)}</a>
          <div style="font-size:12px;color:#8a8273;margin-top:3px;">${esc(s.pastorName)}${s.church ? ` · ${esc(s.church)}` : ""}</div>
          ${s.summary ? `<div style="font-size:13px;color:#4c4639;line-height:1.55;margin-top:8px;">${esc(truncate(s.summary))}</div>` : ""}
          <a href="${SITE_URL}/sermons/${encodeURIComponent(s.slug)}" style="display:inline-block;margin-top:10px;font-size:13px;color:#B5853A;font-weight:600;text-decoration:none;">Listen &rarr;</a>
        </div>
      </td></tr>`
        )
        .join("")}`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5efe2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe2;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Georgia,'Times New Roman',serif;">
        <tr><td style="padding-bottom:8px;">
          <span style="font-size:22px;color:#1B2138;"><span style="color:#B5853A;">i</span>Word</span>
        </td></tr>
        <tr><td>
          <div style="font-size:26px;color:#1B2138;line-height:1.3;">Your week in sermons</div>
          <div style="font-size:14px;color:#8a8273;margin-top:6px;">A few minutes of listening, gathered with care.</div>
        </td></tr>
        ${sectionHtml}
        <tr><td style="padding-top:28px;border-top:1px solid #e7dfcd;">
          <div style="font-size:12px;color:#8a8273;line-height:1.6;">
            You're receiving this because you're part of ${esc(SITE_NAME)}.
            <a href="${unsubUrl}" style="color:#B5853A;">Unsubscribe</a> ·
            <a href="${SITE_URL}" style="color:#B5853A;">Open ${esc(SITE_NAME)}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── sending ───────────────────────────────────────────────────────────────────

async function sendEmail(
  apiKey: string,
  payload: { from: string; to: string; subject: string; html: string }
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
