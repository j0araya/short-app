import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Short App",
  description: "Terms of Service for Short App automated content pipeline.",
};

const LAST_UPDATED = "March 29, 2026";
const APP_NAME = "Short App";
const CONTACT_EMAIL = "contact@short-app.dev";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--color-text)]">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">{APP_NAME}</h1>
        <h2 className="text-xl font-semibold text-[var(--color-muted)] mb-1">
          Terms of Service
        </h2>
        <p className="text-sm text-[var(--color-muted)]">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-10 text-sm leading-relaxed">
        {/* 1 */}
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using {APP_NAME} (&ldquo;the Service&rdquo;), you agree to be bound by
            these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to all of these Terms,
            do not use the Service.
          </p>
          <p className="mt-3">
            These Terms apply to all users of the Service, including operators who connect
            third-party platform accounts (YouTube, TikTok, Instagram, and others) via OAuth
            authorization.
          </p>
        </Section>

        {/* 2 */}
        <Section title="2. Description of the Service">
          <p>
            {APP_NAME} is an automated content pipeline that generates short-form video content
            from publicly available news sources (e.g., Hacker News) and publishes that content
            to connected social media platforms on the operator&rsquo;s behalf.
          </p>
          <p className="mt-3">The Service may use the following third-party platform APIs:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-[var(--color-muted)]">
            <li>
              <strong className="text-[var(--color-text)]">YouTube Data API v3</strong> — to upload
              videos and retrieve statistics via your authorized Google account.
            </li>
            <li>
              <strong className="text-[var(--color-text)]">TikTok Content Posting API</strong> — to
              publish videos to your TikTok creator account using the{" "}
              <code className="bg-[var(--color-border)] px-1 rounded text-xs">video.publish</code>{" "}
              scope.
            </li>
            <li>
              <strong className="text-[var(--color-text)]">Instagram Graph API</strong> — to
              publish Reels and posts to connected Instagram Business or Creator accounts.
            </li>
            <li>
              <strong className="text-[var(--color-text)]">Google Drive API</strong> — to store
              generated video files.
            </li>
          </ul>
        </Section>

        {/* 3 */}
        <Section title="3. User Accounts and Authorization">
          <p>
            The Service requires you to authorize access to third-party platform accounts via
            OAuth 2.0. By granting authorization, you allow the Service to perform actions on your
            behalf as described in Section 2, strictly within the scopes you approve.
          </p>
          <p className="mt-3">
            You may revoke access at any time through each platform&rsquo;s authorization settings:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-[var(--color-muted)]">
            <li>
              Google / YouTube:{" "}
              <span className="text-[var(--color-accent)]">
                myaccount.google.com/permissions
              </span>
            </li>
            <li>
              TikTok:{" "}
              <span className="text-[var(--color-accent)]">
                tiktok.com/settings → Apps and Permissions
              </span>
            </li>
            <li>
              Instagram / Meta:{" "}
              <span className="text-[var(--color-accent)]">
                instagram.com/accounts/manage_access
              </span>
            </li>
          </ul>
          <p className="mt-3">
            Revoking access stops all future actions on those platforms. Previously published
            content remains unaffected.
          </p>
        </Section>

        {/* 4 */}
        <Section title="4. Acceptable Use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-[var(--color-muted)]">
            <li>Publish content that violates the Terms of Service of any connected platform.</li>
            <li>
              Publish spam, misleading, hateful, violent, sexually explicit, or otherwise
              prohibited content.
            </li>
            <li>
              Circumvent platform rate limits, quotas, or API usage policies set by YouTube,
              TikTok, Meta, or Google.
            </li>
            <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
            <li>
              Attempt to access, tamper with, or disrupt the Service or its underlying
              infrastructure.
            </li>
          </ul>
          <p className="mt-3">
            Violation of these rules may result in immediate termination of access and, where
            required, reporting to the relevant platform.
          </p>
        </Section>

        {/* 5 */}
        <Section title="5. Content Ownership and Responsibility">
          <p>
            You retain full ownership of all content published through the Service to your
            connected platform accounts. {APP_NAME} does not claim any intellectual property
            rights over your content.
          </p>
          <p className="mt-3">
            You are solely responsible for ensuring that any content published complies with
            applicable laws, platform community guidelines, and any third-party rights (including
            copyright, trademark, and privacy rights).
          </p>
          <p className="mt-3">
            Content generated from public sources (e.g., Hacker News article titles) is used
            under fair use principles for commentary and informational purposes. You are
            responsible for reviewing all generated content before publishing.
          </p>
        </Section>

        {/* 6 */}
        <Section title="6. Third-Party Platform Compliance">
          <p>
            Use of third-party platform APIs is subject to each platform&rsquo;s own terms and
            developer policies. By using this Service, you also agree to comply with:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-[var(--color-muted)]">
            <li>
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                YouTube Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                YouTube API Services Terms of Service
              </a>
            </li>
            <li>
              <a
                href="https://www.tiktok.com/legal/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                TikTok Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://developers.tiktok.com/doc/tiktok-api-developer-term-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                TikTok Developer Terms of Service
              </a>
            </li>
            <li>
              <a
                href="https://help.instagram.com/581066165581870"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                Instagram Terms of Use
              </a>{" "}
              and{" "}
              <a
                href="https://developers.facebook.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                Meta Platform Terms
              </a>
            </li>
            <li>
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                Google Terms of Service
              </a>
            </li>
          </ul>
        </Section>

        {/* 7 */}
        <Section title="7. API Data Use — YouTube Specific">
          <p>
            This Service uses the YouTube API Services. By using features that interact with
            YouTube, you also agree to the{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <p className="mt-3">
            The Service accesses YouTube data (video upload, statistics retrieval) only with your
            explicit OAuth consent. Tokens are stored securely and used exclusively for the
            described purposes. You may revoke the Service&rsquo;s access to your YouTube account
            at any time via{" "}
            <a
              href="https://security.google.com/settings/security/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              Google Security Settings
            </a>
            .
          </p>
        </Section>

        {/* 8 */}
        <Section title="8. Limitation of Liability">
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW,{" "}
            {APP_NAME.toUpperCase()} DISCLAIMS ALL WARRANTIES INCLUDING FITNESS FOR A PARTICULAR
            PURPOSE, MERCHANTABILITY, AND NON-INFRINGEMENT.
          </p>
          <p className="mt-3">
            {APP_NAME} shall not be liable for any indirect, incidental, special, consequential,
            or punitive damages arising from your use of the Service, including but not limited to
            loss of data, platform account suspension, or content removal by third-party platforms.
          </p>
        </Section>

        {/* 9 */}
        <Section title="9. Modifications to the Service and Terms">
          <p>
            We reserve the right to modify or discontinue the Service at any time. We will make
            reasonable efforts to notify users of material changes to these Terms by updating the
            &ldquo;Last updated&rdquo; date at the top of this page.
          </p>
          <p className="mt-3">
            Continued use of the Service after any changes constitutes acceptance of the new Terms.
          </p>
        </Section>

        {/* 10 */}
        <Section title="10. Termination">
          <p>
            We may suspend or terminate your access to the Service at our sole discretion, without
            prior notice, for conduct that violates these Terms or is otherwise harmful to other
            users, third parties, or the Service itself.
          </p>
        </Section>

        {/* 11 */}
        <Section title="11. Governing Law">
          <p>
            These Terms are governed by applicable law. Any disputes arising from these Terms or
            the Service shall be resolved in the competent courts of the applicable jurisdiction.
          </p>
        </Section>

        {/* 12 */}
        <Section title="12. Contact">
          <p>
            For questions about these Terms, please contact us at:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        {/* Footer nav */}
        <div className="pt-6 border-t border-[var(--color-border)] flex gap-6 text-xs text-[var(--color-muted)]">
          <a href="/privacy" className="hover:text-[var(--color-text)] transition-colors">
            Privacy Policy
          </a>
          <a href="/" className="hover:text-[var(--color-text)] transition-colors">
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-base font-semibold text-[var(--color-text)] mb-3 pb-1 border-b border-[var(--color-border)]">
        {title}
      </h3>
      <div className="text-[var(--color-muted)]">{children}</div>
    </section>
  );
}
