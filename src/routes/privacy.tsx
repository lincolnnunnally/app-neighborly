import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { CounselReviewBanner } from "@/components/legal/counsel-review-banner";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-6 py-12">
        <p className="text-sm text-fg-muted">
          <Link to="/" className="hover:text-fg">
            Home
          </Link>{" "}
          · Privacy
        </p>
        <h1 className="font-display text-3xl font-semibold text-fg">Privacy Policy</h1>
        <p className="text-sm text-fg-muted">Last updated: August 29, 2026</p>
        <CounselReviewBanner product="Neighborly" />
        <div className="prose-neighbor space-y-4 text-fg-muted">
          <p>
            Neighborly is operated by{" "}
            <strong className="text-fg">United Under God, Inc.</strong> This policy explains
            what information we collect and how we use it when you use Neighborly
            (including Vidalia and other community boards).
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">What we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account details you provide (name, email, password if you use email sign-in).</li>
            <li>
              Profile answers you choose to share (skills, interests, life season, faith
              posture, hopes, city).
            </li>
            <li>
              Community activity: needs, offers, services, events, RSVPs, facility requests,
              invites, and messages you post.
            </li>
            <li>
              Safety reports and blocks you submit, so we can review harm and keep your feed
              clean.
            </li>
            <li>Technical data needed to run the service (session cookies, basic device/browser info).</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">How we use it</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>To run your community board so neighbors can help each other.</li>
            <li>To keep accounts secure, recover passwords, and prevent abuse.</li>
            <li>
              To recommend sibling Life Produces Life tools (Kids Need Dads, Kindred,
              Presence, and others) based on what you told us — we do not silently create
              accounts in those apps.
            </li>
            <li>To improve Neighborly and related United Under God tools.</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">Sharing</h2>
          <p>
            Content you post in a community is visible to other members of that community
            according to how the board works. We do not sell your personal information. We
            may use trusted infrastructure providers (hosting, database, email) solely to
            operate the product. Reports may be seen by the owner so they can act.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">Retention and your choices</h2>
          <p>
            You can edit your profile in the app. To close an account or ask what we store,
            write{" "}
            <a className="text-primary underline" href="mailto:lincoln@unitedundergod.org">
              lincoln@unitedundergod.org
            </a>
            . We keep safety reports as needed to protect the community.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">Contact</h2>
          <p>
            Questions:{" "}
            <a className="text-primary underline" href="mailto:lincoln@unitedundergod.org">
              lincoln@unitedundergod.org
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
