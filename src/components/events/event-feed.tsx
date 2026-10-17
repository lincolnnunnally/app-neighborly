import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarHeart } from "lucide-react";
import type { EventSearchResult, PublicEvent } from "@/lib/events/types";
import { Button } from "@/components/ui/button";
import { EventCard, EventRow, dayKey, isKidCentric, isKidFriendly } from "./event-card";
import { cn } from "@/lib/utils";
import { CHIPS, chipCounts, filterByChip, type ChipId } from "@/lib/events/chips";

export type FeedMode = "all" | "kids" | "me";

const MODES: { id: FeedMode; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "kids", label: "With kids" },
  { id: "me", label: "Just me" },
];

export function filterMode(list: PublicEvent[], mode: FeedMode): PublicEvent[] {
  if (mode === "kids") return list.filter(isKidFriendly);
  if (mode === "me") return list.filter((e) => !isKidCentric(e));
  return list;
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/&amp;|&/g, "and").replace(/\b(the|a|an)\b/g, "").replace(/[^a-z0-9]+/g, "");
}

function dayHeading(key: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(
    new Date(`${key}T12:00:00Z`),
  );
}

function groupByDay(list: PublicEvent[], nowMs: number): [string, PublicEvent[]][] {
  const map = new Map<string, PublicEvent[]>();
  for (const e of list) {
    const k = dayKey(Math.max(e.startMs, nowMs));
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(e);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ModeChips({ mode, onMode }: { mode: FeedMode; onMode: (m: FeedMode) => void }) {
  return (
    <div role="group" aria-label="Who is going" className="flex flex-wrap gap-2">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={mode === m.id}
          onClick={() => onMode(m.id)}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-5 text-base font-medium transition-colors",
            mode === m.id
              ? "border-primary bg-primary text-primary-fg"
              : "border-border bg-bg-elevated text-fg hover:bg-bg-subtle",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Distance filter: shareable via ?radius=. */
function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

export function RadiusChips({
  radius,
  choices,
  hrefFor,
  onPick,
}: {
  radius: number;
  choices: readonly number[];
  hrefFor: (r: number) => string;
  onPick?: (r: number) => void;
}) {
  return (
    <div role="group" aria-label="How far" className="flex flex-wrap items-center gap-2">
      <span className="text-base text-fg-muted">Within</span>
      {choices.map((r) => (
        <a
          key={r}
          href={hrefFor(r)}
          onClick={(e) => {
            if (onPick && plainClick(e)) {
              e.preventDefault();
              onPick(r);
            }
          }}
          aria-current={radius === r ? "true" : undefined}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-base font-medium transition-colors",
            radius === r ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg-elevated text-fg hover:bg-bg-subtle",
          )}
        >
          {r} mi
        </a>
      ))}
    </div>
  );
}

/**
 * "What kind?" chips with honest counts for the current radius. Shareable via
 * ?cat=. Tapping the active chip again clears it back to All.
 */
export function CategoryChips({
  chip,
  events,
  hrefFor,
  onPick,
}: {
  chip: ChipId | undefined;
  events: PublicEvent[];
  hrefFor: (c: ChipId | undefined) => string;
  onPick?: (c: ChipId | undefined) => void;
}) {
  const counts = chipCounts(events);
  const item = (id: ChipId | undefined, label: string, n: number) => {
    const target = id && chip === id ? undefined : id;
    return (
    <a
      key={id ?? "all"}
      href={hrefFor(target)}
      onClick={(e) => {
        if (onPick && plainClick(e)) {
          e.preventDefault();
          onPick(target);
        }
      }}
      aria-current={chip === id ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-medium transition-colors",
        chip === id ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg-elevated text-fg hover:bg-bg-subtle",
      )}
    >
      {label}
      <span className={cn("text-sm", chip === id ? "text-primary-fg/90" : "text-fg-muted")}>{n}</span>
    </a>
    );
  };
  return (
    <nav aria-label="What kind of event" className="flex flex-wrap gap-2">
      {item(undefined, "All", events.length)}
      {CHIPS.map((c) => item(c.id, c.label, counts[c.id]))}
    </nav>
  );
}

export function EmptyWeekend({
  town,
  slug,
  zip,
  city,
  state,
  wider,
}: {
  town: string;
  slug?: string;
  zip?: string;
  city?: string;
  state?: string;
  wider?: { href: string; label: string } | null;
}) {
  return (
    <div className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-accent-soft text-accent">
        <CalendarHeart className="h-7 w-7" aria-hidden />
      </span>
      <div className="space-y-3">
        <h3 className="font-display text-2xl font-semibold text-fg">Nothing posted for {town} this weekend yet</h3>
        <p className="text-base text-fg-muted">
          Be the first. Host a coffee, a walk, or a game night, and neighbors nearby will see it.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {slug ? (
            <Button asChild>
              <Link to="/c/$slug" params={{ slug }} search={{ tab: "events", host: "1" } as never}>
                Host something
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/near">Start your town</Link>
            </Button>
          )}
          {wider && (
            <Button asChild variant="secondary">
              <a href={wider.href}>{wider.label}</a>
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link
              to="/churches"
              search={{ zip: zip || undefined, city: city || undefined, state: state || undefined } as never}
            >
              See churches near {town}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The weekend list: this weekend by day, then "a short drive away", then next weekend.
 * Honest when thin: never pads with old or far-off items without saying so.
 */
export function WeekendFeed({
  feed,
  town,
  slug,
  zip,
  city,
  state,
  mode,
  widerHref,
  limit,
  showNext = true,
  chip,
  clearChipHref,
}: {
  feed: EventSearchResult | null;
  town: string;
  slug?: string;
  zip?: string;
  city?: string;
  state?: string;
  mode: FeedMode;
  widerHref?: string;
  limit?: number;
  showNext?: boolean;
  chip?: ChipId;
  clearChipHref?: string;
}) {
  const events = useMemo(() => filterByChip(filterMode(feed?.events ?? [], mode), chip), [feed, mode, chip]);
  // "Worth the drive" is the band past the radius out to ~100 mi. Nothing in it
  // repeats a card already listed above (same title, any day or venue).
  const nearby = useMemo(() => {
    const listed = new Set((feed?.events ?? []).map((e) => titleKey(e.title)));
    return filterByChip(filterMode(feed?.nearby ?? [], mode), chip).filter((e) => !listed.has(titleKey(e.title)));
  }, [feed, mode, chip]);
  const next = useMemo(() => filterByChip(filterMode(feed?.nextWeekend ?? [], mode), chip), [feed, mode, chip]);
  const chipLabel = chip ? CHIPS.find((c) => c.id === chip)?.label : undefined;
  const shown = limit ? events.slice(0, limit) : events;
  const groups = groupByDay(shown, feed ? Date.parse(feed.generatedAt) : 0);
  const [allNearby, setAllNearby] = useState(false);
  const [allNext, setAllNext] = useState(false);
  const nearbyCap = allNearby ? nearby.length : Math.min(nearby.length, limit ? Math.max(2, limit - shown.length) : 6);
  const nextCap = allNext ? next.length : Math.min(next.length, limit ? 4 : 10);
  const near = feed?.place.zip || feed?.place.label || zip || "";
  const wide = feed?.wideRadiusMi ?? 60;

  return (
    <div className="space-y-10">
      {shown.length === 0 && chipLabel ? (
        <div className="surface-card space-y-3 p-6 sm:p-8">
          <h3 className="font-display text-2xl font-semibold text-fg">
            No {chipLabel.toLowerCase()} within {feed?.radiusMi ?? 60} miles this weekend
          </h3>
          <p className="text-base text-fg-muted">
            {nearby.length ? "There is more a longer drive out, below." : "Try everything, or a wider distance."}
          </p>
          {clearChipHref && (
            <Button asChild variant="secondary">
              <a href={clearChipHref}>Show everything</a>
            </Button>
          )}
        </div>
      ) : shown.length === 0 ? (
        <EmptyWeekend
          town={town}
          slug={slug}
          zip={zip}
          city={city}
          state={state}
          wider={
            widerHref && !nearby.length
              ? { href: widerHref, label: `Look within ${wide} miles` }
              : null
          }
        />
      ) : limit ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} near={near} />
          ))}
        </div>
      ) : (
        groups.map(([key, list]) => (
          <section key={key} aria-label={dayHeading(key)} className="space-y-4">
            <h3 className="text-base font-bold uppercase tracking-wide text-fg-muted">{dayHeading(key)}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <EventCard key={e.id} event={e} near={near} />
              ))}
            </div>
          </section>
        ))
      )}

      {nearby.length > 0 && (!limit || shown.length < limit) && (
        <section className="space-y-4" aria-labelledby="worth-the-drive">
          <div>
            <h3 id="worth-the-drive" className="font-display text-2xl font-semibold text-fg">
              Worth the drive this weekend <span className="text-fg-muted">({nearby.length})</span>
            </h3>
            <p className="text-base text-fg-muted">
              {nearbyCap < nearby.length ? `Showing ${nearbyCap} of ${nearby.length}` : nearby.length}{" "}
              {nearby.length === 1 ? "event" : "events"} {feed?.radiusMi ?? 60}–{wide} miles from {town}, past your{" "}
              {feed?.radiusMi ?? 60}-mile filter. Nothing here repeats the list above.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {nearby.slice(0, nearbyCap).map((e) => (
              <EventRow key={e.id} event={e} near={near} />
            ))}
          </div>
          {!limit && !allNearby && nearby.length > nearbyCap && (
            <Button variant="secondary" onClick={() => setAllNearby(true)}>
              Show all {nearby.length}
            </Button>
          )}
        </section>
      )}

      {showNext && next.length > 0 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-display text-2xl font-semibold text-fg">
              Next weekend <span className="text-fg-muted">({next.length})</span>
            </h3>
            <p className="text-base text-fg-muted">
              {feed?.nextWindow.label} · {nextCap < next.length ? `showing ${nextCap} of ${next.length}` : next.length}{" "}
              {next.length === 1 ? "event" : "events"} within {feed?.radiusMi ?? 60} miles
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {next.slice(0, nextCap).map((e) => (
              <EventRow key={e.id} event={e} near={near} />
            ))}
          </div>
          {!limit && !allNext && next.length > nextCap && (
            <Button variant="secondary" onClick={() => setAllNext(true)}>
              Show all {next.length}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
