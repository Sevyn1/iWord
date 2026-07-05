"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestFeed, ingestAllFeeds, discoverFeeds } from "@/lib/ingestion/orchestrator";

/**
 * Admin feed-management actions. All are gated by {@link requireAdmin} and use
 * the service-role client, since the `feeds` table has no public RLS policy.
 */

function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Add a podcast/RSS feed to the scan list (and ingest it immediately). */
export async function addFeed(formData: FormData) {
  await requireAdmin();
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  if (!url) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data, error } = await admin
    .from("feeds")
    .upsert(
      { kind: "podcast", url, active: true },
      { onConflict: "kind,url", ignoreDuplicates: true }
    )
    .select("id");
  if (error) return;

  // First-time add: pull its episodes now so the operator sees results.
  if (data && data.length > 0) {
    const result = await ingestFeed(admin, url);
    await admin
      .from("feeds")
      .update({
        last_scanned_at: new Date().toISOString(),
        last_status: result.ok
          ? `ok · +${result.added} new, ${result.skipped} existing`
          : `error · ${result.error ?? "unknown"}`,
      })
      .eq("id", data[0].id);
  }

  revalidatePath("/admin/feeds");
}

/** Toggle a feed active/inactive (inactive feeds are skipped by the cron). */
export async function setFeedActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("feeds").update({ active }).eq("id", id);
  revalidatePath("/admin/feeds");
}

/** Remove a feed from the scan list. Ingested content is left in place. */
export async function deleteFeed(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("feeds").delete().eq("id", id);
  revalidatePath("/admin/feeds");
}

/** Run the full ingestion pass now (same work the daily cron does). */
export async function scanNow() {
  await requireAdmin();
  await ingestAllFeeds();
  revalidatePath("/admin/feeds");
}

/**
 * Discover feeds via Podcast Index for a search term and add them to the scan
 * list (active). They'll be ingested on the next scan / cron run.
 */
export async function discoverNow(formData: FormData) {
  await requireAdmin();
  const term = String(formData.get("term") ?? "").trim();
  if (!term) return;

  const admin = createAdminClient();
  if (!admin) return;

  await discoverFeeds(admin, [term]);
  revalidatePath("/admin/feeds");
}
