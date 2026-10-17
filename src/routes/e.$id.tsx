import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus, Clock, ExternalLink, MapPin, Navigation } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NotFoundPage } from "@/components/layout/not-found";
import { RsvpButton } from "@/components/events/rsvp-button";
import { icsHrefFor, placePhoto } from "@/components/events/event-card";
import { cardLabels } from "@/lib/events/chips";
import { runsLabel } from "@/lib/events/time";
import { getEventDetail } from "@/lib/community/event-detail";
import type { PublicEvent } from "@/lib/events/types";

type EventSearch = { near?: string; rsvp?: string };

const TZ = "America/New_York";

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).padStart(5, "0");
  return undefined;
}

function whenFull(e: PublicEvent): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(e.startMs);
  if (e.allDay || e.multiDay) {
    if (e.multiDay && e.endMs) {
      const end = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(e.endMs - 1);
      return `${day} – ${end}`;
    }
    return `${day} · All day`;
  }
  const t = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
  return `${day} · ${t(e.startMs)}${e.endMs ? ` – ${t(e.endMs)}` : ""} ET`;
}

function directionsHref(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

function placeLine(venue: string, city: string): string {
  return city && !venue.toLowerCase().includes(city.toLowerCase()) ? `${venue}, ${city}` : venue;
}

export const Route = createFileRoute("/e/$id")({
  validateSearch: (s: Record<string, unknown>): EventSearch => ({
    near: str(s.near),
    rsvp: s.rsvp === "1" || s.rsvp === 1 ? "1" : undefined,
  }),
  loaderDeps: ({ search }) => ({ near: search.near }),
  loader: async ({ params, deps }) => {
    const detail = await getEventDetail({ data: { id: params.id, near: deps.near } }).catch(() => null);
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => {
    const e = loaderData?.event;
    const title = e ? `${e.title} — Neighborly` : "Event — Neighborly";
    const desc = e ? `${whenFull(e)} at ${placeLine(e.venue, e.city)}.` : "";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  notFoundComponent: () => (
    <NotFoundPage
      title="This event is no longer listed"
      line="It may have ended or moved. Here's what's on this weekend instead."
    />
  ),
  component: EventPage,
});

function EventPage() {
  const { event: e, board, description, hostName } = Route.useLoaderData();
  const { near, rsvp } = Route.useSearch();
  const place = placeLine(e.venue, e.city);
  const isBoard = e.sourceId === "board";
  const runs = e.multiDay ? null : runsLabel(`${e.summary} ${description ?? ""}`, e.startMs);
  const organizerSite = !isBoard && e.url.startsWith("http") ? e.url : "";
  const photo = e.image ? null : placePhoto(e);
  const backHref = board
    ? { to: "/c/$slug" as const, params: { slug: board.slug }, search: { tab: "events" } }
    : { to: "/weekend" as const, search: near ? { q: near } : {} };

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="page-shell max-w-3xl space-y-8 py-8 sm:py-12">
        <Link {...backHref} className="tap inline-flex min-h-11 items-center gap-2 text-base font-medium text-fg-muted no-underline hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {board ? `Back to ${board.name}` : "Back to this weekend"}
        </Link>

        <article className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
          {e.image ? (
            <img src={e.image} alt="" referrerPolicy="no-referrer" className="h-56 w-full object-cover sm:h-72" />
          ) : photo ? (
            <img src={photo.src} alt={photo.alt} className="h-56 w-full object-cover sm:h-72" />
          ) : null}
          <div className="space-y-6 p-5 sm:p-8">
            <div className="space-y-3">
              {cardLabels(e).length > 0 && <span className="eyebrow">{cardLabels(e).join(" · ")}</span>}
              <h1 className="font-display text-3xl font-semibold leading-tight text-fg sm:text-4xl [overflow-wrap:anywhere]">
                {e.title}
              </h1>
            </div>

            <dl className="grid gap-4 text-base">
              <div className="flex items-start gap-3">
                <Clock className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <dt className="sr-only">When</dt>
                  <dd className="font-semibold text-fg">{whenFull(e)}</dd>
                  {runs && <dd className="text-fg-muted">{runs}. Hours vary by day; this listing is for the date above.</dd>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <dt className="sr-only">Where</dt>
                  <dd className="font-semibold text-fg [overflow-wrap:anywhere]">{place}</dd>
                  {e.otherPlaces?.length ? (
                    <dd className="text-fg-muted">
                      Also at:{" "}
                      {e.otherPlaces.map((p) => placeLine(p.venue, p.city)).join(" · ")}
                    </dd>
                  ) : null}
                </div>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {isBoard && <RsvpButton eventId={e.id} initialCount={e.rsvpCount ?? 0} autoConfirm={rsvp === "1"} />}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={directionsHref(place)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-base font-semibold text-primary-fg no-underline"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Directions
                <span className="sr-only">(opens maps)</span>
              </a>
              <a
                href={icsHrefFor(e)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg-elevated px-4 text-base font-medium text-fg no-underline hover:bg-bg-subtle"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Add to calendar
              </a>
            </div>

            {description ? (
              <section className="space-y-2">
                <h2 className="font-display text-xl font-semibold text-fg">About this</h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-fg">{description}</p>
              </section>
            ) : null}

            <section className="space-y-2 border-t border-border pt-5">
              <h2 className="font-display text-xl font-semibold text-fg">Who's hosting</h2>
              {isBoard ? (
                <p className="text-base text-fg-muted">
                  {hostName && !/public listing|system/i.test(hostName) ? `Posted by ${hostName} on the ` : "Posted on the "}
                  {board ? (
                    <Link to="/c/$slug" params={{ slug: board.slug }} search={{ tab: "events" }} className="font-semibold text-primary underline">
                      {board.name} board
                    </Link>
                  ) : (
                    "neighbor board"
                  )}
                  . Plans can change — check the board before you go.
                </p>
              ) : (
                <>
                  <p className="text-base text-fg-muted">From {e.organizer}. Times and details can change — check with them before you go.</p>
                  {organizerSite && (
                    <a
                      href={organizerSite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-primary underline"
                    >
                      {e.organizer}
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      <span className="font-normal text-fg-muted no-underline">(opens organizer site)</span>
                    </a>
                  )}
                </>
              )}
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
