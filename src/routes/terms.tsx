import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { CounselReviewBanner } from "@/components/legal/counsel-review-banner";

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
        <p className="text-sm text-fg-muted">Last updated: August 29, 2026</p>
        <CounselReviewBanner product="Neighborly" />
        <div className="space-y-4 text-fg-muted">
          <p>
            Neighborly (“the Platform”) is a community board operated by{" "}
            <strong className="text-fg">United Under God, Inc.</strong>, a Georgia corporation.
            By creating an account or using the boards (including Vidalia and other
            communities), you agree to these terms.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">1. Purpose</h2>
          <p>
            Neighborly helps neighbors post real needs, offer real help, plan gatherings, and
            look after one another. You must post honestly. Do not invent people, needs,
            businesses, or events. Empty boards stay empty until a real person posts.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">2. Your responsibilities</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Be truthful about who you are and what you can offer or need.</li>
            <li>
              Keep personal street addresses private until you choose to share them with a
              matched helper.
            </li>
            <li>
              Do not harass, scam, or endanger anyone. Use Report on a person, need, or
              event. Use Block to remove someone from your feed. Reports go to the owner
              ops desk for review.
            </li>
            <li>
              Obey local law when offering paid services. Youth offerings need parental
              awareness.
            </li>
            <li>
              Meeting in person is always optional. Prefer public places. Neighborly does
              not screen neighbors for you.
            </li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">3. Safety and crisis</h2>
          <p>
            Neighborly is not emergency services, medical care, therapy, or a substitute for
            calling for help. In an emergency, contact local authorities first.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">988 Suicide &amp; Crisis Lifeline</strong> — call or
              text 988 in the U.S.
            </li>
            <li>
              <strong className="text-fg">Crisis Text Line</strong> — text HOME to 741741
            </li>
            <li>Your local emergency number</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">4. Accounts</h2>
          <p>
            Keep your login secure. Neighborly email/password accounts are separate from
            Kindred, Kids Need Dads, Presence, Aligned Souls, and Live On Mission unless you
            used the same Google/X identity. A password reset here does not change those
            other apps. We may suspend accounts that abuse the board, post fabricated
            content as real, or harm the community.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">5. First market</h2>
          <p>
            Vidalia, Georgia is the first live community we are serving. Listings you see
            are real posts from people who joined — we will not pad the board with fake
            neighbors.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">6. Changes</h2>
          <p>
            We may update these terms as the product grows. The date at the top will
            change. Continued use after an update means you accept the current version.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">7. Contact</h2>
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
