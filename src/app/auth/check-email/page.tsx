import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-20">
      <div className="text-center mb-8">
        <Logo size={36} />
      </div>
      <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-gold/15 ring-1 ring-gold/40 flex items-center justify-center mb-5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold">
            <path d="M4 6h16v12H4z" strokeWidth="1.6" />
            <path d="m4 7 8 6 8-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-cream">Check your email</h1>
        <p className="text-cream-muted mt-2">
          We just sent you a confirmation link. Click it to finish creating your
          account, then come back here to sign in.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-6 inline-flex items-center px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
