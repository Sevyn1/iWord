import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: nextParam } = await searchParams;
  const next = safeNextPath(nextParam);

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next);
  }

  const signInHref = next !== "/" ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in";

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <Logo size={36} />
      </div>
      <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-7">
        <h1 className="font-display text-2xl text-cream">Create your iWord account</h1>
        <p className="text-cream-muted text-sm mt-1">
          Free forever — upgrade any time.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-rose/15 ring-1 ring-rose/40 px-3 py-2 text-sm text-rose">
            {error}
          </div>
        )}

        <form action={signUp} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Full name" name="name" placeholder="Jane Doe" required />
          <Field label="Email" type="email" name="email" placeholder="you@example.com" required />
          <Field label="Password" type="password" name="password" placeholder="At least 8 characters" minLength={8} required />
          <Field
            label="City or ZIP code"
            name="location"
            placeholder="e.g. Surulere, Lagos or 30303"
          />
          <p className="text-[11px] text-cream-faint -mt-2">
            We use this only to recommend local pastors and events. Never shared.
          </p>
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
          >
            Create account
          </button>
        </form>
        <p className="mt-6 text-sm text-cream-muted text-center">
          Already have an account?{" "}
          <Link href={signInHref} className="text-gold hover:text-gold-hot">
            Sign in
          </Link>
        </p>
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
