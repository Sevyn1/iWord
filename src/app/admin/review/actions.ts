"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Moderation-queue actions. Drafts (is_published = false) are invisible to the
 * public site via RLS; these actions publish or discard them. All are gated by
 * {@link requireAdmin} and use the service-role client.
 */

function revalidateContent() {
  revalidatePath("/admin/review");
  revalidatePath("/sermons");
  revalidatePath("/");
}

/** Publish a single sermon draft. */
export async function approveSermon(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("sermons").update({ is_published: true }).eq("id", id);
  revalidateContent();
}

/** Discard a draft. Only unpublished rows can be deleted from the queue. */
export async function rejectSermon(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin
    .from("sermons")
    .delete()
    .eq("id", id)
    .eq("is_published", false);
  revalidateContent();
}

/** Publish every pending draft from one feed (e.g. after vetting a source). */
export async function approveAllFromFeed(formData: FormData) {
  await requireAdmin();
  const feedUrl = String(formData.get("feedUrl") ?? "");
  if (!feedUrl) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin
    .from("sermons")
    .update({ is_published: true })
    .eq("feed_url", feedUrl)
    .eq("is_published", false);
  revalidateContent();
}

/** Take a published sermon back down (e.g. after a takedown request). */
export async function unpublishSermon(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("sermons").update({ is_published: false }).eq("id", id);
  revalidateContent();
}
