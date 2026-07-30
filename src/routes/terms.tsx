import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-6 py-12">
        <p className="text-sm text-fg-muted">
          <Link to="/" className="hover:text-fg">
            Home
          </Link>{" "}
          · Terms
        </p>
        <h1 className="font-display text-3xl font-semibold text-fg">Terms of Service</h1>
        <p className="text-sm text-fg-muted">Last updated: July 30, 2026</p>
        <div className="space-y-4 text-fg-muted">
          <p>
            Neighborly (“the Platform”) is operated by United Under God. By creating an account or
            using the community boards, you agree to these terms.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">1. Purpose</h2>
          <p>
            Neighborly helps neighbors post real needs, offer real help, plan gatherings, and look
            after one another. You must post honestly. Do not invent people, needs, or businesses.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">2. Your responsibilities</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Be truthful about who you are and what you can offer or need.</li>
            <li>Keep personal street addresses private until you choose to share them with a matched helper.</li>
            <li>Do not harass, scam, or endanger anyone. Report abuse promptly.</li>
            <li>Obey local law when offering paid services (youth offerings need parental awareness).</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">3. Safety</h2>
          <p>
            Meeting in person is always optional and at your own risk. Use public places when
            possible. In an emergency, contact local authorities first — Neighborly is not emergency
            services.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">4. Accounts</h2>
          <p>
            Keep your login secure. We may suspend accounts that abuse the board, post fabricated
            content as real, or harm the community.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">5. Contact</h2>
          <p>
            <a className="text-primary underline" href="mailto:lincoln@unitedundergod.org">
              lincoln@unitedundergod.org
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
