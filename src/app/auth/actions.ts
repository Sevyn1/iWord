"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Best-effort origin for building absolute confirmation-email links. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Append the `next` param to an auth page path when it's a real destination. */
function withNext(path: string, next: string): string {
  return next && next !== "/"
    ? `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`
    : path;
}

export async function signUp(formData: FormData) {
  const next = safeNextPath(asString(formData.get("next")));
  const supabase = await createClient();
  if (!supabase) {
    redirect(withNext("/auth/sign-up?error=Supabase+is+not+configured.+See+README.", next));
  }

  const email    = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  const fullName = asString(formData.get("name"));
  const location = asString(formData.get("location"));

  if (!email || !password) {
    redirect(withNext("/auth/sign-up?error=Email+and+password+are+required.", next));
  }
  if (password.length < 8) {
    redirect(withNext("/auth/sign-up?error=Password+must+be+at+least+8+characters.", next));
  }

  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, location },
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : undefined,
    },
  });

  if (error) {
    redirect(withNext(`/auth/sign-up?error=${encodeURIComponent(error.message)}`, next));
  }

  revalidatePath("/", "layout");
  redirect("/auth/check-email");
}

export async function signIn(formData: FormData) {
  const next = safeNextPath(asString(formData.get("next")));
  const supabase = await createClient();
  if (!supabase) {
    redirect(withNext("/auth/sign-in?error=Supabase+is+not+configured.+See+README.", next));
  }

  const email    = asString(formData.get("email"));
  const password = asString(formData.get("password"));

  if (!email || !password) {
    redirect(withNext("/auth/sign-in?error=Email+and+password+are+required.", next));
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withNext(`/auth/sign-in?error=${encodeURIComponent(error.message)}`, next));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
