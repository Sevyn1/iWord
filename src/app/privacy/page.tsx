import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — iWord",
  description:
    "How iWord collects, uses, and protects your personal information, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 3, 2026">
      <p>
        This Privacy Policy explains what information iWord collects, how we use
        it, and the choices you have. By using iWord, you agree to the practices
        described here.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign up, we collect
          your email address and any profile details you provide, such as your
          name and location.
        </li>
        <li>
          <strong>Usage information.</strong> We record which sermons you play
          so we can offer features like &ldquo;recently played,&rdquo; enforce
          free-tier limits, and improve the Service.
        </li>
        <li>
          <strong>Payment information.</strong> Paid subscriptions are processed
          by Stripe. We do not store your full card details; Stripe handles
          them. We keep limited billing status (for example, your plan and
          whether a payment is overdue).
        </li>
        <li>
          <strong>Technical information.</strong> To protect the Service from
          abuse (such as bulk downloading), we process your IP address. For
          anonymous streaming limits and rate limiting, we store only a hashed,
          non-reversible form of your IP — not the raw address.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To process subscriptions and manage billing.</li>
        <li>
          To enforce usage limits and protect against fraud, abuse, and
          unauthorized access.
        </li>
        <li>To communicate with you about your account or the Service.</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>
        We do not sell your personal information. We share it only with service
        providers that help us run iWord, including:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing and subscription
          management.
        </li>
        <li>
          <strong>Supabase</strong> — authentication, database, and file
          storage.
        </li>
        <li>
          <strong>Hosting/infrastructure providers</strong> — to serve the
          website and audio.
        </li>
      </ul>
      <p>
        We may also disclose information if required by law or to protect the
        rights, safety, and property of iWord or others.
      </p>

      <h2>4. Cookies and sessions</h2>
      <p>
        We use cookies and similar technologies to keep you signed in and to
        make the Service work. These are essential to core functionality.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as
        needed to provide the Service. Abuse-prevention records (such as hashed
        IP activity) are short-lived and pruned regularly. You may request
        deletion of your account and associated data.
      </p>

      <h2>6. Your rights and choices</h2>
      <ul>
        <li>
          You can access and update your profile information from your account.
        </li>
        <li>
          You can cancel your subscription at any time from billing settings.
        </li>
        <li>
          You can request access to, correction of, or deletion of your personal
          information by contacting us.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have additional rights under laws
        such as the GDPR or CCPA.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures to protect your information, including
        encryption in transit and access controls. No method of transmission or
        storage is completely secure, so we cannot guarantee absolute security.
      </p>

      <h2>8. Children&rsquo;s privacy</h2>
      <p>
        iWord is not directed to children under 13 (or the minimum age of
        digital consent in your region), and we do not knowingly collect their
        personal information.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material
        changes, we will take reasonable steps to notify you and will update the
        &ldquo;last updated&rdquo; date above.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or requests about your privacy? Email us at{" "}
        <a href="mailto:hello@iword.app">hello@iword.app</a>.
      </p>

      <p className="text-cream-faint text-sm">
        This document is a general template provided for convenience and is not
        legal advice. Please have it reviewed by a qualified professional before
        relying on it for your business.
      </p>
    </LegalPage>
  );
}
