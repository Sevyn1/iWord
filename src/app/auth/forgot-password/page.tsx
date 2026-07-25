import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { requestPasswordReset } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/account");
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <Logo size={36} />
      </div>
      <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-7">
        {sent ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-gold/15 ring-1 ring-gold/40 flex items-center justify-center mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold">
                <path d="M4 6h16v12H4z" strokeWidth="1.6" />
                <path d="m4 7 8 6 8-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="font-display text-2xl text-cream text-center">Check your email</h1>
            <p className="text-cream-muted mt-2 text-center">
              If an account exists for that address, we&apos;ve sent a link to
              reset your password. It expires in an hour.
            </p>
            <Link
              href="/auth/sign-in"
              className="mt-6 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-cream">Reset your password</h1>
            <p className="text-cream-muted text-sm mt-1">
              Enter your email and we&apos;ll send you a link to set a new password.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-rose/15 ring-1 ring-rose/40 px-3 py-2 text-sm text-rose">
                {error}
              </div>
            )}

            <form action={requestPasswordReset} className="mt-6 space-y-4">
              <Field label="Email" type="email" name="email" placeholder="you@example.com" required />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
              >
                Send reset link
              </button>
            </form>
            <p className="mt-6 text-sm text-cream-muted text-center">
              Remembered it?{" "}
              <Link href="/auth/sign-in" className="text-gold hover:text-gold-hot">
                Back to sign in
              </Link>
            </p>
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
