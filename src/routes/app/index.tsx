import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  HandHeart,
  QrCode,
  Sparkles,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptHelpOffer,
  getCommunityFeed,
  getMyActivity,
  getMyMemberships,
  getMyProfile,
  listMyIncomingOffers,
  type ActivityItem,
  type HelpOffer,
} from "@/lib/community/server";
import type {
  CommunityEvent,
  Membership,
  Need,
  Profile,
} from "@/lib/community/types";
import { formatEventWhen } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const user = useCurrentUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [incoming, setIncoming] = useState<HelpOffer[]>([]);
  const [primaryName, setPrimaryName] = useState("your community");
  const [primarySlug, setPrimarySlug] = useState("vidalia");

  useEffect(() => {
    async function load() {
      const [p, m, act, inc] = await Promise.all([
        getMyProfile(),
        getMyMemberships(),
        getMyActivity(),
        listMyIncomingOffers(),
      ]);
      setProfile(p);
      setMemberships(m);
      setActivity(act);
      setIncoming(inc.filter((o) => o.status === "offered"));
      const primary = m.find((x) => x.is_primary) ?? m[0];
      if (primary?.community) {
        setPrimaryName(primary.community.name);
        setPrimarySlug(primary.community.slug);
        const feed = await getCommunityFeed({
          data: { slug: primary.community.slug, userId: user?.id },
        });
        setNeeds(feed.needs.filter((n) => n.status === "open" || n.status === "matched").slice(0, 5));
        setEvents(feed.events.slice(0, 3));
      }
    }
    void load();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Your hub</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Hi{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-fg-muted">
          Primary community: <strong className="text-fg">{primaryName}</strong>
          {memberships.length > 1 ? ` · +${memberships.length - 1} more` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/c/$slug" params={{ slug: primarySlug }}>
              Open community board
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/app/needs">Post or answer a need</Link>
          </Button>
        </div>
      </div>

      {incoming.length > 0 && (
        <Card className="border-accent/30 bg-accent-soft/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Neighbors ready to help you</CardTitle>
            <CardDescription>Accept someone so they know you're counting on them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {incoming.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {o.helper_name} on “{o.need_title}”
                  </p>
                  <p className="text-xs text-fg-muted">{o.message || "No message"}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await acceptHelpOffer({ data: { offerId: o.id } });
                      toast.success(`Accepted ${o.helper_name}`);
                      setIncoming((prev) => prev.filter((x) => x.id !== o.id));
                      setActivity(await getMyActivity());
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Accept
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {profile?.is_new_resident && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-accent" />
              New resident welcome path
            </CardTitle>
            <CardDescription>
              Three easy ways to settle in — meet people, learn the place, show up once.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/neighbors">Meet neighbors</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/events">Find an event</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/needs">Post a small need</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            to: "/app/needs" as const,
            title: "Ask / help",
            body: "Needs board",
            icon: HandHeart,
          },
          {
            to: "/app/events" as const,
            title: "Events",
            body: "RSVP & host",
            icon: CalendarDays,
          },
          {
            to: "/app/places" as const,
            title: "Places",
            body: "Book a room",
            icon: Building2,
          },
          {
            to: "/app/invite" as const,
            title: "Invite",
            body: "Link & QR",
            icon: QrCode,
          },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="surface-card flex items-start gap-3 p-4 no-underline transition-colors hover:border-border-strong"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-medium text-fg">{item.title}</span>
              <span className="text-sm text-fg-muted">{item.body}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Open needs nearby</h2>
            <Link to="/app/needs" className="text-sm text-primary hover:underline">
              All needs
            </Link>
          </div>
          {needs.length === 0 && (
            <p className="text-sm text-fg-muted">No open needs — post one to get started.</p>
          )}
          {needs.map((n) => (
            <Link
              key={n.id}
              to="/app/needs"
              className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
            >
              <div className="mb-1 flex gap-2">
                <Badge variant="secondary">{n.urgency}</Badge>
                <Badge variant="outline">{n.category}</Badge>
                <Badge variant="outline">{n.status}</Badge>
              </div>
              <p className="font-medium text-fg">{n.title}</p>
              <p className="line-clamp-2 text-sm text-fg-muted">{n.description}</p>
            </Link>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Coming up</h2>
            <Link to="/app/events" className="text-sm text-primary hover:underline">
              All events
            </Link>
          </div>
          {events.map((e) => (
            <Link
              key={e.id}
              to="/app/events"
              className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
            >
              <p className="text-xs text-fg-muted">{formatEventWhen(e.starts_at)}</p>
              <p className="font-medium text-fg">{e.title}</p>
              <p className="text-sm text-fg-muted">
                {e.location} · {e.rsvp_count} going
                {e.has_rsvp ? " · you're going" : ""}
              </p>
            </Link>
          ))}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your activity</h2>
        {activity.length === 0 && (
          <p className="text-sm text-fg-muted">
            Offer help, RSVP, or book a place — your trail shows up here.
          </p>
        )}
        {activity.map((a) => (
          <div key={a.id} className="surface-card flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-fg">{a.title}</p>
              <p className="text-xs text-fg-muted">{a.detail}</p>
            </div>
            {a.href && (
              <Button asChild size="sm" variant="ghost">
                <Link to={a.href as "/app/needs"}>Open</Link>
              </Button>
            )}
          </div>
        ))}
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Your communities</CardTitle>
            <CardDescription>Switch focus or add another anytime.</CardDescription>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link to="/app/communities">
              Manage <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {memberships.map((m) => (
            <Badge key={m.id} variant={m.is_primary ? "default" : "secondary"}>
              {m.community?.name}
              {m.is_primary ? " · home" : ""}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
