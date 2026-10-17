import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-6 py-12">
        <p className="text-base text-fg-muted">
          <Link to="/" className="inline-flex min-h-11 items-center hover:text-fg">
            Home
          </Link>{" "}
          · Privacy
        </p>
        <h1 className="font-display text-3xl font-semibold text-fg">Privacy Policy</h1>
        <p className="text-sm text-fg-muted">Last updated: August 29, 2026</p>
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
              Profile answers you choose to share, like your skills, interests, stage of
              life, faith (if you want to share it), what you're hoping for, and your town.
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
              To suggest other free United Under God services that might help you, based on
              what you told us. We never sign you up for anything without asking.
            </li>
            <li>To improve Neighborly and related United Under God tools.</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-fg">Sharing</h2>
          <p>
            Content you post in a community is visible to other members of that community
            according to how the board works. We do not sell your personal information. We
            may use trusted infrastructure providers (hosting, database, email) solely to
            operate the product. Safety reports are reviewed by our team so we can act.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">Retention and your choices</h2>
          <p>
            You can edit your profile in the app any time. To close your account or ask what
            we store about you, contact us below. We keep safety reports as long as needed to
            protect the community.
          </p>
          <h2 className="font-display text-xl font-semibold text-fg">Contact us</h2>
          <p>
            Questions about your privacy? Email{" "}
            <a className="inline-flex min-h-11 items-center text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            and a real person will write back.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
