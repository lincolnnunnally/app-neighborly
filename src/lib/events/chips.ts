/**
 * The weekend page's one event taxonomy. The "What kind?" chips and the label
 * on each card come from the same function, so a chip shows exactly the cards
 * that carry its label. One event can sit under several chips (a bluegrass
 * festival is both Festivals and Music) and then carries both labels. Pure, so
 * the page and the tests count the same way.
 */
import type { PublicEvent } from "./types";

export const CHIPS = [
  { id: "performing", label: "Performing arts" },
  { id: "festivals", label: "Festivals" },
  { id: "music", label: "Music" },
  { id: "family", label: "Family" },
  { id: "markets", label: "Food & markets" },
] as const;

/** Singular / plural nouns for the results heading ("2 festivals within 60 miles"). */
const NOUNS: Record<(typeof CHIPS)[number]["id"], [string, string]> = {
  performing: ["performing arts event", "performing arts events"],
  festivals: ["festival", "festivals"],
  music: ["music event", "music events"],
  family: ["family event", "family events"],
  markets: ["food or market event", "food and market events"],
};

export type ChipId = (typeof CHIPS)[number]["id"];

export function isChipId(v: unknown): v is ChipId {
  return CHIPS.some((c) => c.id === v);
}

/** Sources whose every listing is a stage show. */
const STAGE_SOURCES = new Set(["pal", "averitt"]);

const RULES: Record<ChipId, RegExp> = {
  performing:
    /theat(er|re)|\bplay\b|musical|opera|ballet|dance|symphony|orchestra|choir|chorale|recital|concert|tribute|comedy|improv|stage|performance|performing arts|showcase/i,
  festivals: /festival|\bfest\b|fair\b|carnival|parade|cook-?off|homecoming|jubilee|celebration|oktoberfest|harvest|block party|street party/i,
  music: /concert|music|jazz|\bband\b|symphony|orchestra|choir|bluegrass|gospel|tribute|singer|songwriter|recital|\bopera\b|karaoke|open mic/i,
  family: /kids|child|family|families|story ?time|puppet|halloween|trick.or.treat|pumpkin|costume|junior ranger|scout|petting|hayride|movie at|all ages/i,
  markets: /market|farmers|flea|vendor|craft fair|book sale|yard sale|swap meet|bazaar/i,
};

type Classifiable = Pick<PublicEvent, "title" | "category" | "sourceId" | "summary"> & { venue?: string };

export function chipsFor(e: Classifiable): ChipId[] {
  const text = `${e.title} ${e.summary ?? ""}`;
  // A theater or arts-center venue means a stage show; a festival held at a park does not.
  const stageVenue = /theat(er|re)|performing arts|arts center|center for the arts|auditorium|playhouse|opera house/i.test(e.venue ?? "");
  const out: ChipId[] = [];
  const sports = e.category === "sports";
  if (!sports && (STAGE_SOURCES.has(e.sourceId) || stageVenue || RULES.performing.test(text) || (e.category === "arts" && /show|perform/i.test(text))))
    out.push("performing");
  // A stage show called "A Celebration of …" is a concert, not a festival.
  const stage = STAGE_SOURCES.has(e.sourceId) || stageVenue;
  if (!sports && (stage ? /festival|\bfest\b/i.test(text) : e.category === "festival" || RULES.festivals.test(text))) out.push("festivals");
  if (!sports && (e.category === "music" || RULES.music.test(text))) out.push("music");
  if (e.category === "family" || RULES.family.test(text)) out.push("family");
  if (!sports && (e.category === "food" || RULES.markets.test(text))) out.push("markets");
  return out;
}

/** Labels for events that sit under no chip. None of them reads like a chip. */
const OTHER_LABEL: Partial<Record<PublicEvent["category"], string>> = {
  arts: "Art & exhibits",
  outdoors: "Outdoors",
  sports: "Sports",
  learning: "Classes & talks",
};

/**
 * What a card says it is: the label of every chip it sits under, or, when it
 * sits under none, a non-chip label (Sports, Outdoors, Classes & talks …).
 * Board posts lead with "Neighbors".
 */
export function cardLabels(e: Classifiable): string[] {
  const chips = chipsFor(e).map((id) => CHIPS.find((c) => c.id === id)!.label);
  const lead = e.sourceId === "board" ? ["Neighbors"] : [];
  if (chips.length) return [...lead, ...chips];
  if (lead.length) return lead;
  return [OTHER_LABEL[e.category] ?? "Community event"];
}

/** "17 things within 60 miles", "2 festivals within 60 miles", "No festivals within 15 miles". */
export function resultsHeading(n: number, chip: ChipId | undefined, radiusMi: number): string {
  const where = `within ${radiusMi} miles`;
  if (!chip) return n === 0 ? `Nothing ${where} yet` : n === 1 ? `One thing ${where}` : `${n} things ${where}`;
  const [one, many] = NOUNS[chip];
  return n === 0 ? `No ${many} ${where}` : `${n} ${n === 1 ? one : many} ${where}`;
}

export function filterByChip<T extends Classifiable>(list: T[], chip: ChipId | undefined): T[] {
  if (!chip) return list;
  return list.filter((e) => chipsFor(e).includes(chip));
}

export function chipCounts(list: Classifiable[]): Record<ChipId, number> {
  const out = { performing: 0, festivals: 0, music: 0, family: 0, markets: 0 } as Record<ChipId, number>;
  for (const e of list) for (const c of chipsFor(e)) out[c]++;
  return out;
}
