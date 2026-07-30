import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  HandHeart,
  Link2,
  Mail,
  MapPin,
  QrCode,
  Share2,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityFeed, listCommunities } from "@/lib/community/server";
import type { Community, CommunityEvent, Need, Service } from "@/lib/community/types";
import { KIND_LABELS } from "@/lib/community/types";
import { startDemoNeighbor } from "@/lib/community/try-demo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatEventWhen } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    listCommunities()
      .then(setCommunities)
      .catch(() => setCommunities([]));
    getCommunityFeed({ data: { slug: "milstead" } })
      .then((f) => {
        setNeeds(f.needs.slice(0, 3));
        setServices(f.services.slice(0, 2));
        setEvents(f.events.slice(0, 2));
      })
      .catch(() => undefined);
  }, []);

  const milstead = communities.find((c) => c.slug === "milstead");

  async function tryNow() {
    if (user) {
      await navigate({ to: "/app" });
      return;
    }
    setDemoBusy(true);
    try {
      const res = await startDemoNeighbor({
        code: "MILSTEAD-WELCOME",
        isNew: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("You're in Milstead — everything is live");
      await navigate({ to: "/app" });
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent_50%)]"
        />
        <div className="page-shell relative grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="w-fit">First test market: Milstead.US</Badge>
            <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Neighbors helping neighbors — from a lightbulb to a block party
            </h1>
            <p className="max-w-xl text-lg text-fg-muted">
              Neighborly is a working community board: post needs, offer skills, RSVP to
              gatherings, book places, and invite neighbors with a link or QR. Not a mockup —
              every card opens and every action saves.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" disabled={demoBusy} onClick={() => void tryNow()}>
                {demoBusy ? "Starting…" : user ? "Open my hub" : "Try Neighborly now"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/c/$slug" params={{ slug: "milstead" }}>
                  Browse Milstead live
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/join/$code" params={{ code: "MILSTEAD-QR" }}>
                  Invite / QR path
                </Link>
              </Button>
            </div>
            <p className="text-sm text-fg-subtle">
              “Try now” creates a real neighbor session in one click so help, RSVP, and
              booking work immediately.
            </p>
          </div>

          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">
                {milstead?.name ?? "Milstead"} right now
              </CardTitle>
              <CardDescription>
                Live from the board — tap any row to open the community.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {needs[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "milstead" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <HandHeart className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{needs[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {needs[0].author_name} · {needs[0].urgency}
                    </span>
                  </span>
                </Link>
              )}
              {services[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "milstead" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{services[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {services[0].provider_name} · {services[0].pricing}
                    </span>
                  </span>
                </Link>
              )}
              {events[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "milstead" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{events[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {formatEventWhen(events[0].starts_at)} · {events[0].rsvp_count} going
                    </span>
                  </span>
                </Link>
              )}
              {!needs[0] && (
                <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-bg-subtle" />
              )}
              <Button asChild variant="soft" className="w-full">
                <Link to="/c/$slug" params={{ slug: "milstead" }}>
                  Open full Milstead board
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Built for real community life
          </h2>
          <p className="mt-2 text-fg-muted">
            Help, services, events, facilities, and people next door — all interactive.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Ask for help",
              body: "Post a need, get real offers, accept a neighbor.",
              icon: HandHeart,
              to: "/c/milstead" as const,
            },
            {
              title: "Offer skills & services",
              body: "Businesses, side hustles, and kids earning money.",
              icon: Wrench,
              to: "/c/milstead" as const,
            },
            {
              title: "Gather together",
              body: "Block parties, cleanups, BBQs — RSVP sticks.",
              icon: CalendarDays,
              to: "/c/milstead" as const,
            },
            {
              title: "Reserve places",
              body: "Request the pavilion or community room.",
              icon: MapPin,
              to: "/c/milstead" as const,
            },
            {
              title: "Welcome newcomers",
              body: "New residents get a path to meet people fast.",
              icon: Users,
              to: "/c/milstead" as const,
            },
            {
              title: "Many communities",
              body: "Neighborhood, church, HOA, vacation home — multi-join.",
              icon: Share2,
              to: "/communities" as const,
            },
          ].map((f) => (
            <Link
              key={f.title}
              to={f.to === "/communities" ? "/communities" : "/c/$slug"}
              params={f.to === "/communities" ? undefined : { slug: "milstead" }}
              className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="signup-paths" className="border-y border-border bg-bg-elevated py-16">
        <div className="page-shell">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              How people actually join
            </h2>
            <p className="mt-2 text-fg-muted">
              Website pick, invite link, mailbox QR, or one-click try.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MapPin,
                title: "Pick on the website",
                body: "Browse communities and multi-select the ones that fit.",
              },
              {
                icon: Link2,
                title: "Personal invite link",
                body: "Text, email, Facebook, or YouTube description with a code.",
              },
              {
                icon: QrCode,
                title: "QR on mailboxes",
                body: "Printable flyers neighbors hang on doors.",
              },
              {
                icon: Mail,
                title: "Account + profile",
                body: "Email/password or Google/X, then skills and alerts.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-xl)] border border-border bg-bg p-5"
              >
                <item.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-medium text-fg">{item.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button disabled={demoBusy} onClick={() => void tryNow()}>
              {demoBusy ? "Starting…" : "Try now"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/join/$code" params={{ code: "MILSTEAD-QR" }}>
                Preview mailbox QR flow
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/signup" search={{ community: "milstead", code: "MILSTEAD-WELCOME" }}>
                Full signup form
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Communities ready to explore
            </h2>
            <p className="mt-2 text-fg-muted">
              Milstead is featured. You can belong to more than one.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/communities">See all</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((c) => (
            <Link
              key={c.id}
              to="/c/$slug"
              params={{ slug: c.slug }}
              className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABELS[c.kind]}</Badge>
                {c.is_featured && <Badge>Featured</Badge>}
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{c.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{c.tagline}</p>
              <p className="mt-3 text-xs text-fg-subtle">
                {c.city}, {c.state} · {c.member_count} members · code {c.invite_code}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="page-shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-fg">
            <HandHeart className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold">Neighborly</span>
            <span className="text-sm text-fg-subtle">· Milstead first market · United Under God</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-fg-subtle">
            <Link to="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-fg">
              Terms
            </Link>
            <Link to="/how-it-works" className="hover:text-fg">
              How it works
            </Link>
            <span>Help when you can. Ask when you need. Belong where you live.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
