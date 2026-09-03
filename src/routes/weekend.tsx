import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, CloudSun, MapPin, Sun, Thermometer, Umbrella } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceSearch } from "@/components/community/place-search";
import { JsonLd } from "@/components/community/json-ld";
import { getMyProfile } from "@/lib/community/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { buildWeekendPlan, type WeekendPlan, type WeekendSlot } from "@/lib/community/weekend";
import { formatEventWhen } from "@/lib/utils";

type WeekendSearch = { place?: string; q?: string };

export const Route = createFileRoute("/weekend")({
  validateSearch: (s: Record<string, unknown>): WeekendSearch => ({
    place: typeof s.place === "string" ? s.place : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  loader: async ({ search }) => {
    const plan = await buildWeekendPlan({
      slug: search.place,
      query: search.place || search.q || "vidalia",
    });
    return { plan };
  },
  head: ({ match, loaderData }) => {
    const place = (match.search as WeekendSearch).place || loaderData?.plan.place.slug || "vidalia";
    const label =
      loaderData?.plan.place.name
        ? `${loaderData.plan.place.name}, ${loaderData.plan.place.state}`
        : place === "vidalia"
          ? "Vidalia, GA"
          : place;
    return {
      meta: [
        { title: `What's going on in ${label} this week — Neighborly` },
        {
          name: "description",
          content: `Public gatherings, weather, and a calendar file for ${label}. We will not invent events or neighbors.`,
        },
        { property: "og:title", content: `What's going on in ${label} this week` },
      ],
    };
  },
  component: WeekendPage,
});

function icsHref(slot: WeekendSlot): string {
  const q = new URLSearchParams({
    title: slot.title,
    start: slot.starts_at,
    location: slot.location,
    details: `${slot.why}\n\nSource: ${slot.source} ${slot.sourceUrl}`,
  });
  return `/api/ics?${q.toString()}`;
}

function SlotCard({ slot }: { slot: WeekendSlot }) {
  return (
    <article className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={slot.indoor ? "secondary" : "accent"}>{slot.indoor ? "Indoor" : "Outside"}</Badge>
        <span className="text-sm text-fg-muted">{formatEventWhen(slot.starts_at)}</span>
      </div>
      <h3 className="font-display text-lg font-semibold text-fg">{slot.title}</h3>
      <p className="flex items-start gap-2 text-sm text-fg-muted">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        {slot.location}
      </p>
      <p className="text-sm text-fg">{slot.why}</p>
      <p className="text-xs text-fg-subtle">
        Source:{" "}
        <a href={slot.sourceUrl} className="underline" target="_blank" rel="noreferrer">
          {slot.source}
        </a>
        . Confirm before you go.
      </p>
      <Button asChild size="sm" variant="outline">
        <a href={icsHref(slot)}>
          <CalendarPlus className="h-4 w-4" />
          Add to calendar
        </a>
      </Button>
    </article>
  );
}

function WeekendPage() {
  const search = Route.useSearch();
  const loaded = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [plan, setPlan] = useState<WeekendPlan | null>(loaded.plan);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"child" | "alone">("child");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.place) params.set("place", search.place);
    else if (search.q) params.set("q", search.q);
    else params.set("place", "vidalia");

    void (async () => {
      if (user) {
        try {
          const profile = await getMyProfile();
          if (profile?.interests?.length) params.set("interests", profile.interests.join(","));
          if (profile?.setting_pref) params.set("setting", profile.setting_pref);
          if (profile?.mobility) params.set("mobility", profile.mobility);
        } catch {
          /* guest plan is fine */
        }
      }
      try {
        const res = await fetch(`/api/weekend?${params.toString()}`);
        const d = (await res.json()) as { ok?: boolean; plan?: WeekendPlan; error?: string };
        if (!res.ok || !d.ok || !d.plan) {
          setError(d.error || "Could not load this week's plan. Try another city or ZIP.");
          return;
        }
        setPlan(d.plan);
      } catch {
        setError("Could not load this week's plan. Try another city or ZIP.");
      }
    })();
  }, [search.place, search.q, user]);

  const slots = mode === "child" ? plan?.withChild ?? [] : plan?.alone ?? [];

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell space-y-10 py-12">
        <div className="max-w-2xl space-y-4">
          <Badge>
            {plan?.place ? `${plan.place.city || plan.place.name}, ${plan.place.state || "GA"}` : "This week"}
          </Badge>
          <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-fg">
            What&apos;s going on in {plan?.place?.name || "your town"} this week
          </h1>
          <p className="text-lg text-fg-muted">
            Public calendars stay theirs. Neighborly pulls the ones we can verify so you can plan a
            Saturday with a child — or a quiet week when you don&apos;t. We will not invent a crowd.
            A new town stays empty until someone adds a real listing.
          </p>
          <PlaceSearch defaultValue={plan?.place?.zip || plan?.place?.name || ""} />
          {plan?.refresh?.note && (
            <p className="text-xs text-fg-subtle">{plan.refresh.note}</p>
          )}
          {plan?.place?.created && (
            <p className="text-sm text-fg-muted">
              You are the first person to open {plan.place.name} on Neighborly. The board is saved
              so the next neighbor is not starting from zero.
            </p>
          )}
          {plan?.arrivingNote && (
            <p className="rounded-[var(--radius-lg)] border border-primary/25 bg-primary-soft/40 p-4 text-sm text-fg">
              {plan.arrivingNote}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {plan && (
          <section className="grid gap-3 sm:grid-cols-5">
            {plan.weather.map((d) => (
              <Card key={d.date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </CardTitle>
                  <CardDescription>{d.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-fg">
                  {d.heatWarning ? <Sun className="h-4 w-4" /> : <CloudSun className="h-4 w-4" />}
                  <Thermometer className="h-4 w-4" />
                  {d.maxF}° / {d.minF}°
                  {d.rainChance >= 40 && (
                    <span className="ml-auto flex items-center gap-1 text-fg-muted">
                      <Umbrella className="h-4 w-4" />
                      {d.rainChance}%
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {plan && <p className="text-sm text-fg-muted">{plan.weatherNote}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "child" ? "default" : "secondary"} onClick={() => setMode("child")}>
            Weekend with her
          </Button>
          <Button variant={mode === "alone" ? "default" : "secondary"} onClick={() => setMode("alone")}>
            When I don't have her
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {slots.length === 0 && !error && (
            <p className="text-sm text-fg-muted">
              No dated listings in this window yet. The Pal, Visit Vidalia, and Parks & Rec links
              below still work.
            </p>
          )}
          {slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>

        {plan && (plan.other ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Doesn&apos;t match how you like to spend time</h2>
            <p className="text-sm text-fg-muted">
              Hidden from your main list because of indoor/outdoor or seated vs walking. Still
              real public listings — tap through if you want them.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {(plan.other ?? []).map((slot) => (
                <SlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Meet people</CardTitle>
              <CardDescription>Friendship, not a feed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a className="block underline" href="https://kindred.unitedundergod.org/">
                Kindred — friends who build you up
              </a>
              <Link className="block underline" to="/c/$slug" params={{ slug: "vidalia-dads" }}>
                Vidalia dads
              </Link>
              <Link className="block underline" to="/c/$slug" params={{ slug: "vidalia-pickleball" }}>
                Pickleball
              </Link>
              <a className="block underline" href="https://presence.unitedundergod.org/">
                Presence — coffee, a walk, a meal
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Get established</CardTitle>
              <CardDescription>Belonging in this town.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link
                className="block underline"
                to="/c/$slug"
                params={{ slug: plan?.place?.slug || "vidalia" }}
              >
                {plan?.place?.name || "Vidalia"} board — needs, services, events
              </Link>
              <a className="block underline" href="https://churchconnect.unitedundergod.org/">
                Find a church
              </a>
              <a className="block underline" href="https://liveonmission.unitedundergod.org/">
                Live On Mission — a small way to serve
              </a>
              <a className="block underline" href="https://presence.unitedundergod.org/t/LOOKUP">
                You Are Awesome coin — look up
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Where listings come from</CardTitle>
              <CardDescription>We do not replace their calendars.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(plan?.sources ?? []).map((s) => (
                <p key={s.url}>
                  <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                  <span className="text-fg-muted"> — {s.note}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
      {plan && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `What's going on in ${plan.place.name} this week`,
            itemListElement: [...plan.withChild, ...plan.alone].slice(0, 20).map((slot, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Event",
                name: slot.title,
                startDate: slot.starts_at,
                location: {
                  "@type": "Place",
                  name: slot.location,
                  address: `${plan.place.city}, ${plan.place.state}`,
                },
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                description: slot.why,
              },
            })),
          }}
        />
      )}
    </div>
  );
}
