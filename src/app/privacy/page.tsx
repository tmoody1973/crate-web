import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";

export const metadata = {
  title: "Privacy Policy — Crate",
  description: "How Crate collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)]`}
      style={{ backgroundColor: "#09090b" }}
    >
      <Nav />

      <div className="mx-auto max-w-3xl px-6 py-20 text-zinc-300">
        <h1
          className="mb-2 font-[family-name:var(--font-bebas)] text-5xl tracking-wide"
          style={{ color: "#22d3ee" }}
        >
          PRIVACY POLICY
        </h1>
        <p className="mb-12 text-sm text-zinc-500">Last updated: April 6, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Introduction</h2>
            <p>
              Crate (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the digcrate.app website and AI music research platform.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Information We Collect</h2>
            <p className="mb-3">We collect information in the following ways:</p>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">Account Information</h3>
            <p className="mb-3">
              When you create an account, we collect your name, email address, and profile information through our
              authentication provider (Clerk). We do not store your password directly.
            </p>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">API Keys</h3>
            <p className="mb-3">
              If you provide your own API keys (Anthropic, OpenRouter, Spotify, etc.), they are encrypted and stored
              securely. We use these keys only to make API calls on your behalf during your sessions.
            </p>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">Connected Services (OAuth)</h3>
            <p className="mb-3">
              When you connect services like Spotify, Tumblr, Slack, or Google through Auth0 Token Vault, we store
              OAuth tokens securely via Auth0. We access only the permissions you explicitly grant during the OAuth
              consent flow. We do not access your accounts beyond the scopes you authorize.
            </p>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">Usage Data</h3>
            <p>
              We collect anonymized usage analytics through PostHog to understand how features are used and improve the
              product. This includes page views, feature usage, and session duration. We do not sell this data to third
              parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>To provide and maintain the Crate service</li>
              <li>To process your music research queries via AI models</li>
              <li>To connect to third-party services you authorize (Spotify, Tumblr, Slack, Google Docs)</li>
              <li>To save your research, playlists, and published content</li>
              <li>To personalize your experience with cross-session memory (Pro plan, opt-in)</li>
              <li>To improve our product through anonymized analytics</li>
              <li>To communicate with you about your account or service updates</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. Third-Party Services</h2>
            <p className="mb-3">Crate integrates with the following third-party services:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-zinc-200">Clerk</strong> — Authentication and user management</li>
              <li><strong className="text-zinc-200">Convex</strong> — Database and real-time backend</li>
              <li><strong className="text-zinc-200">Auth0</strong> — OAuth token management (Token Vault) for connected services</li>
              <li><strong className="text-zinc-200">Anthropic / OpenRouter</strong> — AI model providers for research queries</li>
              <li><strong className="text-zinc-200">Spotify, Tumblr, Slack, Google</strong> — Connected services you optionally authorize</li>
              <li><strong className="text-zinc-200">Stripe</strong> — Payment processing for subscriptions</li>
              <li><strong className="text-zinc-200">PostHog</strong> — Product analytics</li>
              <li><strong className="text-zinc-200">Vercel</strong> — Hosting and deployment</li>
            </ul>
            <p className="mt-3">
              Each service has its own privacy policy. We encourage you to review them. We share only the minimum
              information necessary for each integration to function.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. Data Storage and Security</h2>
            <p className="mb-3">
              Your data is stored using Convex (database), Auth0 (OAuth tokens), and Clerk (authentication). All
              data is transmitted over HTTPS. API keys are encrypted at rest.
            </p>
            <p>
              We implement reasonable security measures to protect your information. However, no method of electronic
              storage or transmission is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">6. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Disconnect any connected service at any time via Settings</li>
              <li>Revoke API keys at any time</li>
              <li>Opt out of analytics tracking</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account, we will remove
              your personal data within 30 days. Anonymized analytics data may be retained indefinitely.
              Published content (Telegraph, Tumblr) remains on those platforms under their respective policies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">8. Children&apos;s Privacy</h2>
            <p>
              Crate is not intended for children under 13. We do not knowingly collect personal information from
              children under 13. If you believe we have collected such information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting
              the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, contact us at:{" "}
              <a href="mailto:tarikjmoody@gmail.com" className="text-cyan-400 hover:text-cyan-300">
                tarikjmoody@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
