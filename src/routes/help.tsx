import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Mail, Phone } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { canonicalLinks, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/help")({
  head: () => ({
    links: canonicalLinks("/help"),
    meta: [
      { property: "og:url", content: `${SITE_URL}/help` },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Help — Neighborly" },
      { name: "description", content: "Answers to common questions about Neighborly, and how to reach a real person." },
    ],
  }),
  component: HelpPage,
});

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I find what's on near me?",
    a: (
      <>
        Type your town or ZIP on the{" "}
        <Link to="/weekend" className="font-semibold text-primary underline">
          This weekend
        </Link>{" "}
        page. You'll see festivals, shows, park days and neighbor gatherings, with the weather.
      </>
    ),
  },
  {
    q: "How do I ask for a hand or offer help?",
    a: (
      <>
        Open your town's board, then choose <strong className="text-fg">Ask for a hand</strong> or{" "}
        <strong className="text-fg">Offer help</strong>. You'll need a free account so neighbors know who they're
        talking to.
      </>
    ),
  },
  {
    q: "How do I say I'm going to a gathering?",
    a: (
      <>
        Tap <strong className="text-fg">I'll be there</strong> on any neighbor gathering. We'll ask you to sign in
        first, then bring you right back. Changed your mind? Tap <strong className="text-fg">Going</strong> to cancel.
      </>
    ),
  },
  {
    q: "I can't sign in.",
    a: (
      <>
        Use{" "}
        <Link to="/login" search={{ forgot: "1" }} className="font-semibold text-primary underline">
          Forgot password
        </Link>{" "}
        to get a reset link. Nothing in your inbox or spam after a few minutes? Email us and we'll help.
      </>
    ),
  },
  {
    q: "Someone made me feel unsafe.",
    a: (
      <>
        Use <strong className="text-fg">Report</strong> on the post or profile, or block the person. Our team reviews every
        report. If anyone is in danger, call 911.
      </>
    ),
  },
  {
    q: "My town isn't on Neighborly yet.",
    a: (
      <>
        Search for it anyway — you'll still see what's on nearby. From there you can start your town's board in a
        minute.
      </>
    ),
  },
];

function HelpPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="page-shell max-w-3xl space-y-10 py-10 sm:py-14">
        <header className="space-y-3">
          <span className="eyebrow">Help</span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-fg">How can we help?</h1>
          <p className="text-lg text-fg-muted">Quick answers below. If you'd rather talk to a person, we're here.</p>
        </header>

        <section aria-labelledby="faq" className="space-y-3">
          <h2 id="faq" className="sr-only">
            Common questions
          </h2>
          {FAQ.map((f) => (
            <details key={f.q} className="surface-card group p-0">
              <summary className="flex min-h-14 cursor-pointer items-center px-5 py-3 font-display text-lg font-semibold text-fg">
                {f.q}
              </summary>
              <p className="px-5 pb-5 text-base leading-relaxed text-fg-muted">{f.a}</p>
            </details>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="surface-card space-y-3 p-5">
            <Mail className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="font-display text-xl font-semibold text-fg">Contact us</h2>
            <p className="text-base text-fg-muted">Write any time. A real person reads every message.</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex min-h-11 items-center font-semibold text-primary underline [overflow-wrap:anywhere]"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div className="surface-card space-y-3 p-5">
            <LifeBuoy className="h-6 w-6 text-accent" aria-hidden />
            <h2 className="font-display text-xl font-semibold text-fg">Need help right now?</h2>
            <p className="text-base text-fg-muted">If you or someone else is in danger, call 911.</p>
            <a href="tel:988" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline">
              <Phone className="h-4 w-4" aria-hidden />
              Call or text 988 (Suicide &amp; Crisis Lifeline)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
