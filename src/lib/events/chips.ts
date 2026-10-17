/**
 * The weekend page's one event taxonomy. The "What kind?" chips and the label
 * on each card come from the same function, so a chip shows exactly the cards
 * that carry its label. One event can sit under several chips (a bluegrass
 * festival is both Festivals and Music) and then carries both labels. Pure, so
 * the page and the tests count the same way.
 */
import type { PublicEvent } from "./types";

export const CHIPS = [
  { id: "sports", label: "Sports" },
  { id: "outdoors", label: "Outdoors" },
  { id: "performing", label: "Performing arts" },
  { id: "festivals", label: "Festivals" },
  { id: "music", label: "Music" },
  { id: "family", label: "Family" },
  { id: "markets", label: "Food & markets" },
] as const;

/** Singular / plural nouns for the results heading ("2 festivals within 60 miles"). */
const NOUNS: Record<(typeof CHIPS)[number]["id"], [string, string]> = {
  sports: ["game or match", "games and matches"],
  outdoors: ["outdoor event", "outdoor events"],
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

/**
 * Exhibits, galleries, open studios, receptions: art to look at, not a show.
 * They get "Art & exhibits" and no chip. Checked on the title first; the
 * description only counts when the title doesn't name a show.
 */
const EXHIBIT_TITLE =
  /\bexhibit(ion|s)?\b|\bgallery\b|\bdrawings\b|\bpaintings\b|\bsculpture|\bart show\b|open studios?\b|book as art|\breception\b|\binstallation\b|\bon view\b|collections?-led tour/i;
const EXHIBIT_TEXT = /\b(exhibit|exhibition|on view|gallery|installation|curated|artworks?)\b/i;
const SHOW_TITLE = /theat(er|re)|\bplay\b|musical|opera|ballet|dance|symphony|orchestra|choir|chorale|recital|concert|tribute|comedy|improv|production/i;

const RULES = {
  performing: /theat(er|re)|\bplay\b|musical|opera|ballet|dance|danceworks|salsa|symphony|orchestra|choir|chorale|recital|concert|tribute|comedy|improv|performing arts|auditions?/i,
  festivals: /festival|\bfest\b|\bfair\b|carnival|parade|cook-?off|homecoming|jubilee|oktoberfest|block party|street party|pride\b/i,
  music: /concert|\bmusic\b|jazz|\bband\b|symphony|orchestra|choir|bluegrass|gospel|tribute|singer|songwriter|recital|\bopera\b|karaoke|open mic|guitar|piano/i,
  // Family only when the listing says so: in the title, or an explicit phrase in the description.
  familyTitle: /\b(family|families|kids?|children|child|toddlers?|junior ranger|teach a kid)\b/i,
  familyText: /family[- ]friendly|fun for (the whole )?family|for (the whole )?family|for families|for kids|for children|kids'? (activities|crafts|zone|area|corner)|children'?s (activities|crafts|area)|all ages|bring the (kids|family)/i,
  // Selling food or goods; a book or plant sale is not a market.
  markets: /farmers'? market|green market|flea market|night market|market day|craft (fair|market)|artisan market|vendor market|makers'? market|bazaar|food trucks?|tasting/i,
};

type Classifiable = Pick<PublicEvent, "title" | "category" | "sourceId" | "summary"> & { venue?: string };

export function isExhibit(e: Classifiable): boolean {
  if (EXHIBIT_TITLE.test(e.title)) return true;
  return e.category !== "sports" && !SHOW_TITLE.test(e.title) && !STAGE_SOURCES.has(e.sourceId) && EXHIBIT_TEXT.test(e.summary ?? "");
}

/** Every chip an event sits under. When unsure, none. */
export function chipsFor(e: Classifiable): ChipId[] {
  const out: ChipId[] = [];
  if (e.category === "sports") return ["sports"];
  if (e.category === "outdoors") out.push("outdoors");
  // Art to look at: no chip (labeled "Art & exhibits").
  if (isExhibit(e)) return out;
  const title = e.title;
  const text = `${e.title} ${e.summary ?? ""}`;
  const stage = STAGE_SOURCES.has(e.sourceId);
  // A theater or arts-center venue means a stage show; a planetarium show or a festival at a park does not.
  const stageVenue = /theat(er|re)|performing arts|arts center|center for the arts|auditorium|playhouse|opera house/i.test(e.venue ?? "");
  if (!/planetarium/i.test(title) && (stage || RULES.performing.test(title) || (stageVenue && SHOW_TITLE.test(text)) || (stageVenue && e.category === "arts") || ((e.category === "arts" || e.category === "music") && RULES.performing.test(e.summary ?? ""))))
    out.push("performing");
  // A stage show called "A Celebration of …" is a concert, not a festival.
  if (stage || stageVenue ? /festival|\bfest\b/i.test(title) : e.category === "festival" || RULES.festivals.test(title)) out.push("festivals");
  if (e.category === "music" || RULES.music.test(text)) out.push("music");
  if (RULES.familyTitle.test(title) || RULES.familyText.test(e.summary ?? "")) out.push("family");
  if (/book sale|plant sale/i.test(title) ? false : e.category === "food" || RULES.markets.test(title)) out.push("markets");
  return out;
}

/**
 * What a card says it is: the label of every chip it sits under. With no chip,
 * exhibits and art say "Art & exhibits", classes say "Classes & talks", and
 * anything else carries no label rather than a guess. Board posts lead with
 * "Neighbors".
 */
export function cardLabels(e: Classifiable): string[] {
  const chips = chipsFor(e).map((id) => CHIPS.find((c) => c.id === id)!.label);
  const lead = e.sourceId === "board" ? ["Neighbors"] : [];
  if (chips.length) return [...lead, ...chips];
  if (lead.length) return lead;
  if (isExhibit(e) || (e.category === "arts" && /\bart\b|craft|paint|draw|sculpt|photo|pottery|ceramic|film|screening|movie/i.test(e.title)))
    return ["Art & exhibits"];
  if (e.category === "learning") return ["Classes & talks"];
  return [];
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
  const out = Object.fromEntries(CHIPS.map((c) => [c.id, 0])) as Record<ChipId, number>;
  for (const e of list) for (const c of chipsFor(e)) out[c]++;
  return out;
}
