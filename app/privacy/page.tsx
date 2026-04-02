import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Short App",
  description: "Privacy Policy for Short App automated content pipeline.",
};

const LAST_UPDATED = "April 2, 2026";
const APP_NAME = "short-team";
const APP_DISPLAY_NAME = "Short App";
const CONTACT_EMAIL = "contact@short-app.dev";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--color-text)]">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">{APP_DISPLAY_NAME}</h1>
        <h2 className="text-xl font-semibold text-[var(--color-muted)] mb-1">
          Privacy Policy
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          TikTok App Name: <span className="font-mono">{APP_NAME}</span>
        </p>
      </div>

      <div className="space-y-10 text-sm leading-relaxed">
        {/* 1 */}
        <Section title="1. Introduction">
          <p>
            {APP_NAME} (also known as &ldquo;{APP_DISPLAY_NAME}&rdquo;) (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the Service&rdquo;, &ldquo;the App&rdquo;) is an
            automated content pipeline that generates and publishes short-form video content to
            social media platforms on behalf of its operators.
          </p>
          <p className="mt-3">
            This Privacy Policy explains what data we collect, how we use it, how we protect it,
            and your rights as a user. It applies to all interactions with the Service, including
            OAuth authorizations for YouTube, TikTok, Instagram, and Google services.
          </p>
        </Section>

        {/* 2 */}
        <Section title="2. Data We Collect">
          <p>We collect only the minimum data necessary to operate the Service:</p>

          <SubSection title="2.1 Platform OAuth Tokens">
            <p>
              When you authorize the Service to act on your behalf on a platform (YouTube, TikTok,
              Instagram, Google Drive), we receive and store:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access tokens and refresh tokens for the authorized account</li>
              <li>Account identifiers required by the platform API (e.g., TikTok Open ID)</li>
            </ul>
            <p className="mt-2">
              These tokens are stored securely in environment variables or a secrets manager and
              are never exposed to the browser or logged in plaintext.
            </p>
          </SubSection>

          <SubSection title="2.2 Content Metadata">
            <p>
              We store metadata about generated and published videos in a MongoDB database,
              including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Video title, source article URL, and niche tags</li>
              <li>Platform external IDs (YouTube video ID, TikTok publish ID)</li>
              <li>Publication status, timestamps, view counts, and like counts</li>
              <li>Google Drive file IDs and web view links</li>
              <li>Instagram captions and hashtags you edit</li>
            </ul>
          </SubSection>

          <SubSection title="2.3 Source Data">
            <p>
              The Service scrapes publicly available content from sources such as Hacker News
              (news.ycombinator.com) to generate video scripts. No personal data is extracted from
              these sources — only public article titles and URLs.
            </p>
          </SubSection>

          <SubSection title="2.4 Data We Do NOT Collect">
            <p>We do not collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Passwords or login credentials</li>
              <li>Financial or payment information</li>
              <li>Personal communications (emails, DMs, comments)</li>
              <li>Data from platform users who watch or interact with published content</li>
              <li>Analytics or behavioral tracking data from end viewers</li>
            </ul>
          </SubSection>
        </Section>

        {/* 3 */}
        <Section title="3. How We Use Your Data">
          <p>Data collected is used exclusively to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Authenticate API requests to connected platforms on your behalf</li>
            <li>Upload generated video files to YouTube, TikTok, or Instagram</li>
            <li>Store videos in Google Drive for review and archival</li>
            <li>Track publication status and basic performance metrics (views, likes)</li>
            <li>Display a dashboard for reviewing and managing published content</li>
          </ul>
          <p className="mt-3">
            We do not use your data for advertising, profiling, or any purpose beyond operating
            the Service as described.
          </p>
        </Section>

        {/* 4 */}
        <Section title="4. Third-Party Platform Data Access">
          <p>
            The Service integrates with the following third-party APIs. Each integration accesses
            only the data scopes listed:
          </p>

          <div className="mt-4 space-y-4">
            <PlatformBlock
              name="YouTube (Google)"
              color="#ff0000"
              scopes={[
                "youtube.upload — upload videos to your YouTube channel",
                "youtube.readonly — read video statistics (views, likes)",
              ]}
              policy="https://policies.google.com/privacy"
              policyLabel="Google Privacy Policy"
              revoke="https://security.google.com/settings/security/permissions"
              revokeLabel="Google Security Settings"
              note="Use of the YouTube API Services is additionally governed by the Google Privacy Policy."
            />

            <PlatformBlock
              name="TikTok"
              color="#ff0050"
              scopes={[
                "video.publish — upload and publish videos to your TikTok creator account",
                "user.info.basic — read your Open ID and display name for creator info queries",
              ]}
              policy="https://www.tiktok.com/legal/privacy-policy"
              policyLabel="TikTok Privacy Policy"
              revoke="https://www.tiktok.com/settings"
              revokeLabel="TikTok Settings → Apps and Permissions"
              note="Content posted by apps in sandbox mode may be restricted to private visibility until TikTok app approval."
            />

            <PlatformBlock
              name="Instagram / Meta"
              color="#E1306C"
              scopes={[
                "instagram_content_publish — publish Reels and posts to your Instagram account",
                "instagram_basic — read your Instagram account ID required for publishing",
              ]}
              policy="https://privacycenter.instagram.com/policy"
              policyLabel="Instagram Privacy Policy"
              revoke="https://www.instagram.com/accounts/manage_access/"
              revokeLabel="Instagram → Settings → Apps and Websites"
            />

            <PlatformBlock
              name="Google Drive"
              color="#4285F4"
              scopes={[
                "drive.file — read and write files created by this app only",
              ]}
              policy="https://policies.google.com/privacy"
              policyLabel="Google Privacy Policy"
              revoke="https://myaccount.google.com/permissions"
              revokeLabel="Google Account → Security → Third-party access"
            />
          </div>
        </Section>

        {/* 5 */}
        <Section title="5. Data Storage and Security">
          <p>
            All platform tokens are stored as environment variables on the server and are never
            committed to version control or exposed to the client. Video metadata is stored in
            MongoDB Atlas with access restricted to the application server.
          </p>
          <p className="mt-3">
            Video files are stored temporarily on the server filesystem during processing and then
            uploaded to Google Drive. Local files are removed after a successful upload.
          </p>
          <p className="mt-3">
            We implement reasonable technical measures to protect stored data, including server-side
            access controls and encrypted connections (TLS) to all external APIs.
          </p>
        </Section>

        {/* 6 */}
        <Section title="6. Data Retention">
          <p>
            Video metadata in MongoDB is retained indefinitely unless manually deleted by the
            operator. OAuth tokens are retained until revoked by the user or rotated by the
            Service&rsquo;s token refresh mechanism.
          </p>
          <p className="mt-3">
            You may request deletion of your data at any time by contacting us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        {/* 7 */}
        <Section title="7. Data Sharing">
          <p>
            We do not sell, rent, or share your personal data with any third parties, except as
            required to operate the Service (i.e., transmitting content and tokens to YouTube,
            TikTok, Instagram, and Google Drive APIs as described above) or as required by law.
          </p>
        </Section>

        {/* 8 */}
        <Section title="8. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Access</strong> — request a copy of the data we hold about you
            </li>
            <li>
              <strong>Rectification</strong> — request correction of inaccurate data
            </li>
            <li>
              <strong>Erasure</strong> — request deletion of your data (&ldquo;right to be
              forgotten&rdquo;)
            </li>
            <li>
              <strong>Portability</strong> — receive your data in a machine-readable format
            </li>
            <li>
              <strong>Objection</strong> — object to processing of your data
            </li>
            <li>
              <strong>Revoke OAuth consent</strong> — disconnect any platform at any time via
              platform settings (see Section 4)
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        {/* 9 */}
        <Section title="9. Cookies and Tracking">
          <p>
            {APP_NAME} ({APP_DISPLAY_NAME}) does not use cookies, web beacons, or any client-side tracking
            technologies. No analytics SDKs (Google Analytics, Mixpanel, etc.) are embedded in
            the Service.
          </p>
        </Section>

        {/* 10 */}
        <Section title="10. Children's Privacy">
          <p>
            The Service is not directed to individuals under the age of 13. We do not knowingly
            collect personal data from children. If you believe a child has provided us with
            personal information, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will promptly delete it.
          </p>
        </Section>

        {/* 11 */}
        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will update the &ldquo;Last
            updated&rdquo; date at the top of this page. Continued use of the Service after
            changes constitutes acceptance of the updated policy.
          </p>
        </Section>

        {/* 12 */}
        <Section title="12. Contact">
          <p>
            For questions, requests, or concerns about this Privacy Policy:{" "}
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
          <a href="/terms" className="hover:text-[var(--color-text)] transition-colors">
            Terms of Service
          </a>
          <a href="/" className="hover:text-[var(--color-text)] transition-colors">
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Section components ──────────────────────────────────────────────────────

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

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-[var(--color-text)] mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function PlatformBlock({
  name,
  color,
  scopes,
  policy,
  policyLabel,
  revoke,
  revokeLabel,
  note,
}: {
  name: string;
  color: string;
  scopes: string[];
  policy: string;
  policyLabel: string;
  revoke: string;
  revokeLabel: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-[var(--color-text)] text-sm">{name}</span>
      </div>
      <p className="text-xs text-[var(--color-muted)] mb-2 font-medium uppercase tracking-wide">
        Scopes requested:
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs mb-3">
        {scopes.map((s) => (
          <li key={s}>
            <code className="bg-[var(--color-border)] px-1 rounded">{s.split(" — ")[0]}</code>
            {" — "}
            {s.split(" — ")[1]}
          </li>
        ))}
      </ul>
      {note && (
        <p className="text-xs italic text-[var(--color-muted)] mb-2 border-l-2 border-[var(--color-border)] pl-3">
          {note}
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-xs">
        <a
          href={policy}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          {policyLabel} &rarr;
        </a>
        <a
          href={revoke}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          Revoke access: {revokeLabel} &rarr;
        </a>
      </div>
    </div>
  );
}
