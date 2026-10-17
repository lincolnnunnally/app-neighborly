/**
 * The weekend page's "What kind?" chips. One event can sit under several chips
 * (a bluegrass festival is both Festivals and Music). Pure, so the page and
 * the tests count the same way.
 */
import type { PublicEvent } from "./types";

export const CHIPS = [
  { id: "performing", label: "Performing arts" },
  { id: "festivals", label: "Festivals" },
  { id: "music", label: "Music" },
  { id: "family", label: "Family" },
  { id: "markets", label: "Markets" },
] as const;

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
  if (!sports && (e.category === "festival" || RULES.festivals.test(text))) out.push("festivals");
  if (!sports && (e.category === "music" || RULES.music.test(text))) out.push("music");
  if (e.category === "family" || RULES.family.test(text)) out.push("family");
  if (!sports && RULES.markets.test(text)) out.push("markets");
  return out;
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
