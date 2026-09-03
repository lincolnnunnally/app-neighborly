import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, CloudSun, MapPin, Sun, Thermometer, Umbrella } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeekendPlan, WeekendSlot } from "@/lib/community/weekend";
import { formatEventWhen } from "@/lib/utils";

export const Route = createFileRoute("/weekend")({
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
  const [plan, setPlan] = useState<WeekendPlan | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"child" | "alone">("child");

  useEffect(() => {
    fetch("/api/weekend")
      .then(async (res) => {
        const d = (await res.json()) as { ok?: boolean; plan?: WeekendPlan; error?: string };
        if (!res.ok || !d.ok || !d.plan) {
          setError(d.error || "Could not load this weekend's plan. Try the Vidalia board.");
          return;
        }
        setPlan(d.plan);
      })
      .catch(() => setError("Could not load this weekend's plan. Try the Vidalia board."));
  }, []);

  const slots = mode === "child" ? plan?.withChild ?? [] : plan?.alone ?? [];

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell space-y-10 py-12">
        <div className="max-w-2xl space-y-4">
          <Badge>Vidalia, this weekend</Badge>
          <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-fg">
            One board for what is actually happening
          </h1>
          <p className="text-lg text-fg-muted">
            Visit Vidalia, the Pal Theatre, Parks & Rec, and church calendars stay theirs. Neighborly
            pulls the public ones here so you can plan a Saturday with your daughter — or a week of
            meeting people when she is with her other home. We will not invent a crowd.
          </p>
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
              <Link className="block underline" to="/c/$slug" params={{ slug: "vidalia" }}>
                Vidalia board — needs, services, events
              </Link>
              <a className="block underline" href="https://churchconnect.cloud/">
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
    </div>
  );
}
