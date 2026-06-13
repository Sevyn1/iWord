"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/auth/sign-up?error=Supabase+is+not+configured.+See+README.");
  }

  const email    = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  const fullName = asString(formData.get("name"));
  const location = asString(formData.get("location"));

  if (!email || !password) {
    redirect("/auth/sign-up?error=Email+and+password+are+required.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, location },
    },
  });

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/auth/check-email");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/auth/sign-in?error=Supabase+is+not+configured.+See+README.");
  }

  const email    = asString(formData.get("email"));
  const password = asString(formData.get("password"));

  if (!email || !password) {
    redirect("/auth/sign-in?error=Email+and+password+are+required.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
