import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of iWord, including accounts, subscriptions, billing, and acceptable use.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 3, 2026">
      <p>
        Welcome to iWord. These Terms of Service (&ldquo;Terms&rdquo;) govern
        your access to and use of the iWord website, apps, and services
        (together, the &ldquo;Service&rdquo;). By creating an account or using
        the Service, you agree to these Terms. If you do not agree, please do
        not use the Service.
      </p>

      <h2>1. Who we are</h2>
      <p>
        iWord provides a platform for listening to sermons and gospel messages
        from participating pastors and churches. iWord is operated by{" "}
        <strong>Proximeet Inc.</strong>, a company based in Ontario, Canada.
        Throughout these Terms, &ldquo;we,&rdquo; &ldquo;us,&rdquo; and
        &ldquo;iWord&rdquo; refer to Proximeet Inc.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <ul>
        <li>
          You must be at least 13 years old (or the minimum age of digital
          consent in your region) to create an account.
        </li>
        <li>
          You are responsible for the activity that happens under your account
          and for keeping your login credentials secure.
        </li>
        <li>
          You agree to provide accurate information and to keep it up to date.
        </li>
      </ul>

      <h2>3. Plans, billing, and cancellation</h2>
      <p>
        iWord offers a free tier and paid subscriptions (&ldquo;Devoted&rdquo;
        and &ldquo;Patron&rdquo;). Paid subscriptions are billed in advance on a
        recurring basis through our payment processor, Stripe.
      </p>
      <ul>
        <li>
          <strong>Auto-renewal.</strong> Paid plans renew automatically at the
          end of each billing period until you cancel.
        </li>
        <li>
          <strong>Cancellation.</strong> You may cancel any time from your
          account&rsquo;s billing settings. You keep access to paid features
          through the end of the period you have already paid for.
        </li>
        <li>
          <strong>Failed payments.</strong> If a renewal charge fails, we may
          retry it for a limited grace period during which your access
          continues. If payment is not recovered, your plan reverts to the free
          tier.
        </li>
        <li>
          <strong>Refunds.</strong> Except where required by law, payments are
          non-refundable.
        </li>
        <li>
          <strong>Price changes.</strong> We may change subscription prices;
          we&rsquo;ll give reasonable notice before a change affects you.
        </li>
      </ul>

      <h2>4. Free tier limits</h2>
      <p>
        The free tier includes a limited number of sermon streams per month and
        may include shorter previews for signed-out visitors. These limits help
        us keep the Service sustainable and may change over time.
      </p>

      <h2>5. Acceptable use</h2>
      <p>When using the Service, you agree not to:</p>
      <ul>
        <li>
          Download, copy, redistribute, scrape, or bulk-harvest audio or other
          content except as expressly permitted by the Service.
        </li>
        <li>
          Circumvent, disable, or interfere with security, access controls, or
          usage limits (including streaming caps and rate limits).
        </li>
        <li>
          Share your account or access credentials to give others paid access.
        </li>
        <li>
          Use the Service for any unlawful purpose or in a way that infringes
          the rights of others.
        </li>
      </ul>

      <h2>6. Content and intellectual property</h2>
      <p>
        Sermons and related media are owned by the pastors, churches, or other
        rights holders who make them available, and are licensed to you for
        personal, non-commercial listening only. The iWord name, design, and
        software are owned by iWord. You receive no ownership rights by using
        the Service.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        We rely on third parties to operate the Service, including Stripe
        (payments), Supabase (authentication and data storage), and hosting
        providers. Your use of the Service may also be subject to their terms.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available,&rdquo; without warranties of any kind, whether express or
        implied, to the fullest extent permitted by law. We do not guarantee
        that the Service will be uninterrupted, error-free, or that content will
        always be available.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, iWord will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or
        for any loss of data, revenue, or profits, arising out of or related to
        your use of the Service.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        your access if you violate these Terms or use the Service in a way that
        could harm iWord, other users, or third parties.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material
        changes, we will take reasonable steps to notify you. Your continued use
        of the Service after changes take effect means you accept the updated
        Terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of the{" "}
        <strong>Province of Ontario</strong> and the federal laws of Canada
        applicable therein, without regard to conflict of laws rules. Any
        disputes will be handled in the courts located in Ontario, Canada.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href="mailto:hello@iword.app">hello@iword.app</a>.
      </p>
    </LegalPage>
  );
}
