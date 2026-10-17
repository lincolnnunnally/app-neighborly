import {
  CalendarPlus,
  Drama,
  Leaf,
  Music,
  Palette,
  PartyPopper,
  Trophy,
  UsersRound,
  UtensilsCrossed,
  GraduationCap,
  Baby,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { RsvpButton } from "./rsvp-button";
import type { EventCategory, PublicEvent } from "@/lib/events/types";
import { cn } from "@/lib/utils";

const TZ = "America/New_York";

const CATEGORY: Record<EventCategory, { label: string; icon: LucideIcon; tint: string; fg: string }> = {
  festival: { label: "Festival", icon: PartyPopper, tint: "bg-accent-soft", fg: "text-accent" },
  music: { label: "Music", icon: Music, tint: "bg-sky-soft", fg: "text-sky" },
  arts: { label: "Arts & shows", icon: Drama, tint: "bg-accent-soft", fg: "text-accent" },
  family: { label: "Family", icon: Baby, tint: "bg-primary-soft", fg: "text-primary" },
  outdoors: { label: "Outdoors", icon: Leaf, tint: "bg-primary-soft", fg: "text-primary" },
  sports: { label: "Sports", icon: Trophy, tint: "bg-sky-soft", fg: "text-sky" },
  food: { label: "Food & markets", icon: UtensilsCrossed, tint: "bg-accent-soft", fg: "text-accent" },
  community: { label: "Neighbors", icon: UsersRound, tint: "bg-primary-soft", fg: "text-primary" },
  learning: { label: "Classes & talks", icon: GraduationCap, tint: "bg-sky-soft", fg: "text-sky" },
};

export function categoryMeta(c: EventCategory) {
  return CATEGORY[c] ?? CATEGORY.community;
}

/** Local place photos for well-known Vidalia spots (credited in the footer). */
export function placePhoto(e: PublicEvent): { src: string; alt: string } | null {
  const t = `${e.title} ${e.venue}`.toLowerCase();
  // Generic photos picked by what the event is (credited in the footer).
  if (/pickleball|tennis|\bcourts?\b/.test(t)) return { src: "/img/vidalia/pickleball.jpg", alt: "Outdoor pickleball courts" };
  if (/coffee|café|cafe|latte|espresso/.test(t)) return { src: "/img/vidalia/coffee.jpg", alt: "A cup of coffee on a wooden table" };
  if (!/vidalia/.test(`${e.city} ${e.venue} ${e.organizer}`.toLowerCase()) && e.sourceId !== "board" && e.sourceId !== "pal")
    return null;
  if (/fountain|city hall|jackson st/.test(t)) return { src: "/img/vidalia/fountain.jpg", alt: "The fountain in Vidalia's downtown park" };
  if (/ben smith|park|amphitheater|stockyard|rec complex/.test(t))
    return { src: "/img/vidalia/amphitheater.jpg", alt: "Downtown park amphitheater in Vidalia" };
  if (/downtown|church st/.test(t)) return { src: "/img/vidalia/cityhall.jpg", alt: "The Vidalia Municipal Building downtown" };
  if (/onion/.test(t)) return { src: "/img/vidalia/onions.jpg", alt: "Sweet Vidalia onions" };
  return null;
}

export function dayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function whenLabel(e: PublicEvent): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(e.startMs);
  if (e.allDay || e.multiDay) {
    const date = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(e.startMs);
    return e.multiDay && e.endMs
      ? `${day} ${date} – ${new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(e.endMs - 1)}`
      : `${day}, ${date} · All day`;
  }
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(e.startMs);
  return `${day} · ${time}`;
}

export function icsHrefFor(e: PublicEvent): string {
  const q = new URLSearchParams({
    title: e.title,
    start: new Date(e.startMs).toISOString(),
    location: [e.venue, e.city].filter(Boolean).join(", "),
    details: `${e.summary ? `${e.summary}\n\n` : ""}${e.url.startsWith("http") ? e.url : `https://neighborly.unitedundergod.org${e.url}`}`,
  });
  return `/api/ics?${q.toString()}`;
}

function whereLine(e: PublicEvent): string {
  const parts = [e.venue];
  if (e.city && !e.venue.toLowerCase().includes(e.city.toLowerCase())) parts.push(e.city);
  let line = parts.filter(Boolean).join(", ");
  if (typeof e.distanceMi === "number" && e.distanceMi >= 1) line += ` · ${Math.round(e.distanceMi)} mi`;
  return line;
}

/** In-app detail page. Public events carry `near` so the page can find them again. */
export function eventDetailLink(e: PublicEvent, near?: string): { to: "/e/$id"; params: { id: string }; search: { near?: string } } {
  return {
    to: "/e/$id",
    params: { id: e.id },
    search: e.sourceId === "board" || !near ? {} : { near },
  };
}

function OtherPlaces({ event }: { event: PublicEvent }) {
  const others = event.otherPlaces ?? [];
  if (!others.length) return null;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-primary underline">
        At {others.length + 1} places
      </summary>
      <ul className="mt-1 space-y-1 text-base text-fg-muted">
        {[{ venue: event.venue, city: event.city, distanceMi: event.distanceMi }, ...others].map((p, i) => (
          <li key={i} className="[overflow-wrap:anywhere]">
            {p.venue}
            {p.city && !p.venue.toLowerCase().includes(p.city.toLowerCase()) ? `, ${p.city}` : ""}
            {typeof p.distanceMi === "number" && p.distanceMi >= 1 ? ` · ${Math.round(p.distanceMi)} mi` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function EventCard({ event, compact = false, near }: { event: PublicEvent; compact?: boolean; near?: string }) {
  const meta = categoryMeta(event.category);
  const Icon = meta.icon;
  const [broken, setBroken] = useState(false);
  const local = placePhoto(event);
  const photo = event.image && !broken ? { src: event.image, alt: "" } : local;
  const board = event.sourceId === "board";
  const more = event.alsoOn?.length
    ? `Also ${event.alsoOn
        .map((k) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${k}T12:00:00Z`)))
        .join(", ")}`
    : "";
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-elevated shadow-[0_1px_0_rgba(28,27,25,0.04)] transition-shadow hover:shadow-md">
      <div className={cn("relative", compact ? "h-32" : "h-40", photo ? "bg-bg-subtle" : meta.tint)}>
        {photo ? (
          <img
            src={photo.src}
            alt={photo.alt}
            loading={photo.src.startsWith("/") ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={cn("grid h-full place-items-center", meta.fg)}>
            <Icon className="h-12 w-12" aria-hidden strokeWidth={1.6} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-bg-elevated/95 px-3 py-1 text-sm font-semibold text-fg shadow-sm">
          {board ? "Neighbors" : meta.label}
        </span>
        {event.free && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-fg">
            Free
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <span className="text-base font-bold text-accent">{whenLabel(event)}</span>
        <h3 className="font-display text-xl font-semibold leading-snug text-fg [overflow-wrap:anywhere]">
          <Link {...eventDetailLink(event, near)} className="flex min-h-11 items-center text-fg no-underline hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="flex items-start gap-1.5 text-base text-fg-muted">
          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          <span className="[overflow-wrap:anywhere]">{whereLine(event)}</span>
        </p>
        {more && <p className="text-base text-fg-muted">{more}</p>}
        <OtherPlaces event={event} />
        <p className="mt-auto pt-2 text-base text-fg-muted">
          {board ? "Posted by neighbors" : `From ${event.organizer}`}. Confirm before you go.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {board && <RsvpButton eventId={event.id} initialCount={event.rsvpCount ?? 0} showCount={false} />}
          <Link
            {...eventDetailLink(event, near)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-base font-semibold no-underline",
              board
                ? "border border-border bg-bg-elevated text-fg hover:bg-bg-subtle"
                : "bg-primary text-primary-fg",
            )}
          >
            Details
          </Link>
          <a
            href={icsHrefFor(event)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-bg-elevated px-4 text-base font-medium text-fg no-underline hover:bg-bg-subtle"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Add to calendar
          </a>
        </div>
      </div>
    </article>
  );
}

export function EventRow({ event, near }: { event: PublicEvent; near?: string }) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(event.startMs);
  const d = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" }).format(event.startMs);
  const time = event.allDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(event.startMs);
  const inner = (
    <>
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-center text-sm font-bold uppercase leading-none text-primary">
        <span>
          {wd}
          <span className="block text-2xl">{d}</span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold text-fg [overflow-wrap:anywhere]">{event.title}</span>
        <span className="block text-base text-fg-muted [overflow-wrap:anywhere]">
          {time} · {whereLine(event)}
        </span>
      </span>
    </>
  );
  const cls =
    "flex min-h-[72px] items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-4 py-3 no-underline hover:border-border-strong";
  return (
    <Link {...eventDetailLink(event, near)} className={cls}>
      {inner}
    </Link>
  );
}

export function EventGridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading events">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
          <div className="h-40 animate-pulse bg-bg-subtle" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-bg-subtle" />
            <div className="h-6 w-4/5 animate-pulse rounded bg-bg-subtle" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kid-friendly enough for the "With kids" chip. */
export function isKidFriendly(e: PublicEvent): boolean {
  const t = `${e.title} ${e.summary}`.toLowerCase();
  if (/\b(21\+|wine|beer|brew|cocktail|tasting|bar crawl|happy hour|burlesque)\b/.test(t)) return false;
  return (
    ["family", "festival", "outdoors"].includes(e.category) ||
    /\b(kids?|family|children|child|story ?time|puppet|pumpkin|trick|halloween|fall festival|hayride|zoo|park|parade)\b/.test(t)
  );
}

export function isKidCentric(e: PublicEvent): boolean {
  return e.category === "family" || /\b(kids?|children|story ?time|toddler|puppet)\b/i.test(e.title);
}
