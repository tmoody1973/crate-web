import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";

export const metadata = {
  title: "Terms of Service — Crate",
  description: "Terms and conditions for using the Crate music research platform.",
};

export default function TermsPage() {
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
          TERMS OF SERVICE
        </h1>
        <p className="mb-12 text-sm text-zinc-500">Last updated: April 6, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Crate at digcrate.app (&quot;the Service&quot;), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Description of Service</h2>
            <p>
              Crate is an AI-powered music research platform for DJs, radio producers, journalists, and music
              professionals. The Service provides tools for artist research, influence mapping, show preparation,
              playlist creation, and publishing — powered by AI models and integrated with third-party music and
              communication services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. Accounts</h2>
            <p className="mb-3">
              You must create an account to use Crate. You are responsible for maintaining the security of your
              account and for all activity that occurs under it.
            </p>
            <p>
              You agree to provide accurate, current, and complete information. You may not share your account
              credentials with others or create multiple accounts for the same person.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. API Keys and Connected Services</h2>
            <p className="mb-3">
              Crate allows you to provide your own API keys (BYOK — Bring Your Own Key) for AI model providers
              and to connect third-party services like Spotify, Tumblr, Slack, and Google via OAuth.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>You are responsible for your own API key usage and associated costs</li>
              <li>You must comply with each third-party service&apos;s terms of use</li>
              <li>You can disconnect any service at any time through Settings</li>
              <li>We are not responsible for actions taken on your behalf through connected services based on your instructions to the AI agent</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. Subscription Plans and Billing</h2>
            <p className="mb-3">
              Crate offers free and paid subscription plans. Paid plans are billed monthly through Stripe.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Free plan: Limited research queries per month, basic features</li>
              <li>Pro plan: Increased limits, publishing, cross-session memory, and additional features</li>
              <li>Team plan: Shared access for organizations with a verified email domain</li>
            </ul>
            <p className="mt-3">
              You can cancel your subscription at any time. Cancellation takes effect at the end of the current
              billing period. We do not offer refunds for partial months.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to reverse-engineer, copy, or redistribute the Service</li>
              <li>Abuse rate limits or attempt to circumvent usage restrictions</li>
              <li>Use the Service to generate spam, misleading content, or impersonate others</li>
              <li>Share, republish, or monetize AI-generated content in ways that misrepresent it as original human work without disclosure</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">7. Intellectual Property</h2>
            <p className="mb-3">
              Crate&apos;s software, design, branding, and documentation are owned by us and protected by intellectual
              property laws.
            </p>
            <p>
              Content you create using Crate (research, playlists, published articles) belongs to you. However, AI-generated
              content may be subject to the terms of the underlying AI model provider (Anthropic, OpenRouter).
              You are responsible for ensuring your use of generated content complies with applicable laws and the
              terms of the AI providers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">8. AI-Generated Content</h2>
            <p className="mb-3">
              Crate uses AI models to generate research, summaries, and recommendations. You acknowledge that:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>AI-generated content may contain inaccuracies or errors</li>
              <li>We do not guarantee the accuracy, completeness, or reliability of AI output</li>
              <li>You should verify important information before relying on it</li>
              <li>AI-generated content should not be treated as professional music industry, legal, or financial advice</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">9. Published Content</h2>
            <p>
              When you publish content through Crate to third-party platforms (Telegraph, Tumblr, Slack, Google Docs),
              that content becomes subject to the respective platform&apos;s terms of service. We are not responsible for
              content after it is published to external platforms. You are solely responsible for the content you choose
              to publish.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">10. Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. To the maximum extent
              permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data,
              use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">11. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these Terms. You may delete
              your account at any time. Upon deletion, your data will be removed in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">12. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Material changes will be communicated via email or an in-app
              notice. Continued use of the Service after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Wisconsin, United States, without regard to
              conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">14. Contact</h2>
            <p>
              Questions about these Terms? Contact us at:{" "}
              <a href="mailto:tarik@radiomilwaukee.org" className="text-cyan-400 hover:text-cyan-300">
                tarik@radiomilwaukee.org
              </a>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
