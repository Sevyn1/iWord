import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Copyright & Content Removal",
  description:
    "How to report copyrighted material and request removal of content from iWord, including the notice-and-takedown process and our designated contact.",
};

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright & Content Removal" updated="July 24, 2026">
      <p>
        iWord is a directory that helps people find sermons and gospel messages.
        Most audio on the Service is aggregated from publicly available podcast
        (RSS) feeds published by pastors, churches, and other rights holders,
        and is streamed from the original source. iWord does not claim ownership
        of that content.
      </p>
      <p>
        We respect the rights of creators and copyright owners. If you believe
        content on iWord infringes your copyright, or you are a rights holder
        who wants your material removed, this page explains how to reach us and
        what happens next.
      </p>

      <h2>Who can request removal</h2>
      <ul>
        <li>
          A copyright owner (or someone authorised to act on their behalf) whose
          work appears on the Service.
        </li>
        <li>
          A pastor, church, or feed owner who no longer wishes their podcast to
          be listed on iWord, even where no infringement has occurred.
        </li>
      </ul>

      <h2>How to submit a notice</h2>
      <p>
        Send a written notice to our designated contact at{" "}
        <a href="mailto:copyright@iword.app">copyright@iword.app</a>. To help us
        act quickly, please include:
      </p>
      <ul>
        <li>
          Your name, organisation (if any), and contact information (email and,
          if relevant, a mailing address).
        </li>
        <li>
          Identification of the copyrighted work or material you are concerned
          about (for example, the sermon or podcast title).
        </li>
        <li>
          The specific iWord URL(s) where the material appears, so we can locate
          it.
        </li>
        <li>
          A statement that you have a good-faith belief that the use is not
          authorised by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement that the information in your notice is accurate, and that
          you are the copyright owner or authorised to act on their behalf.
        </li>
        <li>Your physical or electronic signature.</li>
      </ul>

      <h2>What we do after receiving a notice</h2>
      <ul>
        <li>
          We aim to acknowledge valid notices promptly and to remove or disable
          access to the identified content, or stop listing the relevant feed,
          without undue delay.
        </li>
        <li>
          Because we stream from source feeds, removing a listing on iWord stops
          us surfacing the content; it does not delete the file from the
          original publisher.
        </li>
        <li>
          We may keep a record of notices for our legal and operational purposes.
        </li>
      </ul>

      <h2>Counter-notice</h2>
      <p>
        If your content was removed and you believe that was a mistake or
        misidentification, you may send a counter-notice to{" "}
        <a href="mailto:copyright@iword.app">copyright@iword.app</a>. Include the
        content that was removed and where it appeared, your contact
        information, and a statement, made in good faith, that the content was
        removed as a result of mistake or misidentification.
      </p>

      <h2>Repeat infringers</h2>
      <p>
        In appropriate circumstances, we may remove feeds and restrict accounts
        associated with repeated infringement.
      </p>

      <h2>Designated contact</h2>
      <p>
        Copyright and content-removal requests: {" "}
        <a href="mailto:copyright@iword.app">copyright@iword.app</a>. iWord is
        operated by <strong>Proximeet Inc.</strong>, Ontario, Canada. For all
        other enquiries, email{" "}
        <a href="mailto:hello@iword.app">hello@iword.app</a>.
      </p>
    </LegalPage>
  );
}
