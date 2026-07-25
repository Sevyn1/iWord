import Link from "next/link";
import { Logo } from "@/components/Logo";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // The emailed link is exchanged for a short-lived session in /auth/callback
  // before landing here. Without that session there is nothing to update.
  const supabase = await createClient();
  const hasSession = supabase ? Boolean((await supabase.auth.getUser()).data.user) : false;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <Logo size={36} />
      </div>
      <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-7">
        <h1 className="font-display text-2xl text-cream">Choose a new password</h1>

        {!hasSession ? (
          <>
            <p className="text-cream-muted text-sm mt-1">
              This reset link is invalid or has expired. Request a fresh one to
              continue.
            </p>
            <Link
              href="/auth/forgot-password"
              className="mt-6 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <p className="text-cream-muted text-sm mt-1">
              Enter a new password for your account.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-rose/15 ring-1 ring-rose/40 px-3 py-2 text-sm text-rose">
                {error}
              </div>
            )}

            <form action={updatePassword} className="mt-6 space-y-4">
              <Field label="New password" type="password" name="password" placeholder="••••••••" required minLength={8} />
              <Field label="Confirm password" type="password" name="confirm" placeholder="••••••••" required minLength={8} />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
              >
                Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.15em] text-cream-faint mb-1.5">{label}</span>
      <input
        {...rest}
        className="w-full px-4 py-2.5 rounded-full bg-ink ring-1 ring-line focus:ring-gold outline-none text-cream placeholder:text-cream-faint"
      />
    </label>
  );
}
