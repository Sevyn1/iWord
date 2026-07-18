"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin overrides for church logos and pastor headshots. Ingestion auto-fills
 * these when it can; this lets an operator correct or supply them by hand. All
 * gated by {@link requireAdmin} + the service-role client (no public RLS).
 */

function cleanUrl(raw: string): string | null {
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

/** Set (or clear, when blank) a church's logo URL. */
export async function setChurchLogo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const raw = String(formData.get("logo_url") ?? "");
  const logo = raw.trim() === "" ? null : cleanUrl(raw);
  if (raw.trim() !== "" && !logo) return; // reject an invalid, non-empty URL

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("churches").update({ logo_url: logo }).eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/churches");
}

/** Set (or clear, when blank) a pastor's profile photo URL. */
export async function setPastorImage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const raw = String(formData.get("image_url") ?? "");
  const image = raw.trim() === "" ? null : cleanUrl(raw);
  if (raw.trim() !== "" && !image) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("pastors").update({ image_url: image }).eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/pastors");
}
