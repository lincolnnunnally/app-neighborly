export type EventCategory =
  | "festival"
  | "music"
  | "arts"
  | "family"
  | "outdoors"
  | "sports"
  | "food"
  | "community"
  | "learning";

/** One public happening, normalized from any source. Times are UTC epoch ms. */
export type PublicEvent = {
  id: string;
  title: string;
  startMs: number;
  endMs: number | null;
  allDay: boolean;
  /** Runs across several days (exhibits, multi-day festivals). */
  multiDay: boolean;
  venue: string;
  city: string;
  lat: number | null;
  lon: number | null;
  url: string;
  image: string | null;
  /** Who is putting it on — shown as "From …". Never a ticketing or data vendor. */
  organizer: string;
  sourceId: string;
  category: EventCategory;
  free: boolean | null;
  summary: string;
  distanceMi?: number;
  /** Other days in the same window this exact event repeats (YYYY-MM-DD). */
  alsoOn?: string[];
  /** Same title and start time at other venues (e.g. one watch party listed at 3 bars). */
  otherPlaces?: { id: string; venue: string; city: string; distanceMi?: number; url: string }[];
  /** Neighbor-board events only: how many neighbors said they're going. */
  rsvpCount?: number;
};

export type SourceStatus = {
  id: string;
  name: string;
  url: string;
  status: "ok" | "cached" | "stale" | "error";
  count: number;
};

export type EventSearchResult = {
  place: { label: string; lat: number; lon: number; zip: string };
  radiusMi: number;
  wideRadiusMi: number;
  window: { label: string; startIso: string; endIso: string; friKey: string; sunKey: string; tz: string };
  nextWindow: { label: string; startIso: string; endIso: string; friKey: string; sunKey: string; tz: string };
  /** This weekend, inside the chosen radius. */
  events: PublicEvent[];
  /** This weekend, a longer drive out (radius … wideRadius). */
  nearby: PublicEvent[];
  /** Next weekend, inside the wide radius — shown when this weekend is thin. */
  nextWeekend: PublicEvent[];
  sources: SourceStatus[];
  generatedAt: string;
};
