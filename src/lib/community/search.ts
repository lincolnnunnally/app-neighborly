/**
 * Free-text search across everything a neighbor can find in Neighborly.
 *
 * Why this exists: the board and the app pages only ever offered *pre-named*
 * chips (Food pantries / Reservable / a service category / a date window). A
 * neighbor who wanted "food pantry", "bible study", or "someone to change a
 * lightbulb" had nothing to type into. This module is the shared, pure half of
 * the fix — query parsing, intent expansion, scoring, and the door
 * suggestions — so the server (SQL) and the client (filtering an already
 * loaded board) rank the same words the same way.
 *
 * Nothing here invents content. Expansion only widens which REAL rows match a
 * word; door suggestions only point at pages that already exist.
 */

export type SearchKind =
  | "need"
  | "event"
  | "service"
  | "tool"
  | "pantry"
  | "place"
  | "community"
  | "neighbor";

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  snippet: string;
  /** Short context line — city, hours, category, when. */
  meta: string;
  badges: string[];
  href: string;
  community_slug: string;
  community_name: string;
  /** Higher is better. Computed by scoreFields. */
  score: number;
  /**
   * True when only a SYNONYM matched, never a word the neighbor typed. A search
   * for "bible study" on a board with no Bible study still turns up churches
   * via expansion; those are worth offering, but never as if they were what was
   * asked for.
   */
  loose: boolean;
  /** ISO date used only to break ties between equally relevant hits. */
  created_at?: string;
};

export type SearchScope = "all" | SearchKind;

/** Scope chips. `all` first — the point of this feature is not having to pick. */
export const SEARCH_SCOPES: { id: SearchScope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "pantry", label: "Food pantries" },
  { id: "need", label: "Needs" },
  { id: "event", label: "Events & groups" },
  { id: "service", label: "Services" },
  { id: "tool", label: "Tools" },
  { id: "place", label: "Places" },
  { id: "community", label: "Communities" },
  { id: "neighbor", label: "Neighbors" },
];

export const KIND_LABELS: Record<SearchKind, string> = {
  need: "Need",
  event: "Event",
  service: "Service",
  tool: "Tool",
  pantry: "Food pantry",
  place: "Place",
  community: "Community",
  neighbor: "Neighbor",
};

/**
 * Words that carry no signal in a two-or-three word local query. Dropped only
 * when something else survives — "in the area" still searches for "area".
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "around",
  "as",
  "at",
  "be",
  "can",
  "close",
  "do",
  "does",
  "for",
  "from",
  "get",
  "has",
  "have",
  "here",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "near",
  "nearby",
  "of",
  "on",
  "or",
  "our",
  "some",
  "that",
  "the",
  "there",
  "this",
  "to",
  "us",
  "want",
  "was",
  "we",
  "what",
  "where",
  "who",
  "with",
  "you",
  "your",
]);

/**
 * Intent expansion. A neighbor types how they talk ("free groceries", "somebody
 * to fix my porch", "bible study"), and real rows are written how the person
 * who posted them talks. Each entry maps a spoken word to other words that mean
 * the same thing locally, so one honest listing is findable by all of them.
 *
 * Bidirectional: every word in a group expands to the whole group.
 */
const SYNONYM_GROUPS: string[][] = [
  // Food assistance — the query that started this.
  [
    "pantry",
    "pantries",
    "food",
    "foodbank",
    "groceries",
    "grocery",
    "hungry",
    "meal",
    "meals",
    "commodities",
    "commodity",
    "distribution",
    "giveaway",
  ],
  // Faith / ministry — the user's other stated goal.
  [
    "bible",
    "study",
    "ministry",
    "ministries",
    "discipleship",
    "smallgroup",
    "prayer",
    "worship",
    "church",
    "faith",
    "fellowship",
    "devotional",
  ],
  ["volunteer", "serve", "serving", "service", "outreach", "mission", "help", "helping"],
  ["kids", "kid", "child", "children", "youth", "teen", "teens", "student", "students"],
  ["senior", "seniors", "elderly", "elder", "older", "aging"],
  ["ride", "rides", "transport", "transportation", "driving", "drive"],
  ["yard", "lawn", "grass", "mow", "mowing", "landscaping", "trim", "trimming"],
  ["repair", "fix", "fixing", "broken", "handyman", "maintenance"],
  ["clean", "cleaning", "cleanup", "tidy", "trash", "litter"],
  ["tutor", "tutoring", "homework", "teach", "teaching", "lesson", "lessons", "class", "classes"],
  ["borrow", "lend", "loan", "rent", "rental", "tool", "tools"],
  ["pet", "pets", "dog", "dogs", "cat", "cats", "animal", "animals"],
  ["move", "moving", "movers", "haul", "hauling", "lift", "lifting", "furniture"],
  ["sitter", "babysitter", "babysitting", "childcare", "daycare", "nanny"],
  ["book", "books", "reading", "library", "bookclub"],
  ["game", "games", "trivia", "cards", "board"],
  ["pickleball", "tennis", "court", "courts", "racquet"],
  ["party", "gathering", "cookout", "bbq", "barbecue", "potluck", "picnic"],
  ["room", "rooms", "hall", "pavilion", "venue", "facility", "space", "reserve", "reservation"],
  ["light", "lightbulb", "bulb", "lamp", "electrical"],
  ["computer", "phone", "tech", "internet", "wifi", "printer", "laptop"],
];

const SYNONYMS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      const existing = map.get(word) ?? [];
      map.set(word, Array.from(new Set([...existing, ...group.filter((w) => w !== word)])));
    }
  }
  return map;
})();

export type ParsedQuery = {
  /** Exactly what the neighbor typed. */
  raw: string;
  /** Lowercased, punctuation-collapsed. */
  normalized: string;
  /** Quoted "phrases like this" — matched whole. */
  phrases: string[];
  /** Words the neighbor typed (stopwords dropped when possible). */
  tokens: string[];
  /** tokens + synonyms. Used to widen the SQL net and to score. */
  expanded: string[];
  /** A 5-digit ZIP typed on its own routes to the town lookup instead. */
  zip: string;
  isEmpty: boolean;
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s"'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Singular/plural and possessive folding — cheap, no stemmer dependency. */
function fold(token: string): string {
  let t = token.replace(/['']s$/, "");
  if (t.length > 4 && t.endsWith("ies")) t = `${t.slice(0, -3)}y`;
  else if (t.length > 3 && t.endsWith("es") && !/(s|x|z|ch|sh)es$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = (raw ?? "").trim();
  const phrases: string[] = [];
  // Pull out "quoted phrases" before tokenizing so they stay whole.
  const withoutPhrases = trimmed.replace(/"([^"]+)"/g, (_m, inner: string) => {
    const p = normalize(inner);
    if (p) phrases.push(p);
    return " ";
  });

  const normalized = normalize(trimmed);
  const rawTokens = normalize(withoutPhrases)
    .split(" ")
    .filter((t) => t.length > 1);

  const meaningful = rawTokens.filter((t) => !STOPWORDS.has(t));
  const tokens = Array.from(new Set((meaningful.length ? meaningful : rawTokens).map(fold)));

  const expandedSet = new Set(tokens);
  for (const t of tokens) {
    for (const syn of SYNONYMS.get(t) ?? []) expandedSet.add(fold(syn));
    // "foodbank" / "bookclub" style compounds also expand from their halves.
    for (const [word, group] of SYNONYMS) {
      if (word.length > 4 && t.startsWith(word)) group.forEach((s) => expandedSet.add(fold(s)));
    }
  }

  const zipMatch = trimmed.match(/^\s*(\d{5})\s*$/);

  return {
    raw: trimmed,
    normalized,
    phrases,
    tokens,
    expanded: Array.from(expandedSet),
    zip: zipMatch ? zipMatch[1] : "",
    isEmpty: tokens.length === 0 && phrases.length === 0,
  };
}

/**
 * Ceiling that scoreFields() puts on a synonym-only match. Anything at or below
 * it matched no typed word, so callers present it as "loosely related".
 */
export const LOOSE_MATCH_MAX = 5;

export type ScoredField = {
  /** Raw text from a real row. */
  text: string;
  /** Title-ish fields weigh more than a long description. */
  weight: number;
};

/**
 * Score one row against the query.
 *
 * A hit only counts as a match if at least one word the neighbor ACTUALLY typed
 * appears (`tokens`), or a quoted phrase does. Synonyms add score but never
 * create a match on their own — otherwise searching "food" would drag in every
 * BBQ event and "help" would return the entire needs board.
 */
export function scoreFields(parsed: ParsedQuery, fields: ScoredField[]): number {
  if (parsed.isEmpty) return 0;

  const prepared = fields.map((f) => ({
    weight: f.weight,
    text: normalize(f.text ?? ""),
  }));

  let score = 0;
  let typedMatch = false;

  for (const phrase of parsed.phrases) {
    for (const f of prepared) {
      if (phrase && f.text.includes(phrase)) {
        score += f.weight * 12;
        typedMatch = true;
      }
    }
  }

  for (const token of parsed.tokens) {
    for (const f of prepared) {
      if (!f.text) continue;
      const words = f.text.split(" ");
      if (words.some((w) => fold(w) === token)) {
        score += f.weight * 6;
        typedMatch = true;
      } else if (f.text.includes(token)) {
        // Substring hit: "pantr" inside "pantries", "onion" inside "onions".
        score += f.weight * 3;
        typedMatch = true;
      }
    }
  }

  // Multi-word queries: reward rows that cover more of what was typed.
  if (parsed.tokens.length > 1) {
    const covered = parsed.tokens.filter((t) =>
      prepared.some((f) => f.text.includes(t) || f.text.split(" ").some((w) => fold(w) === t)),
    ).length;
    if (covered === parsed.tokens.length) score += 10 * parsed.tokens.length;
    else score += 2 * covered;
  }

  if (!typedMatch) {
    // Synonym-only: keep it findable but always below a literal match, and only
    // when the neighbor's own words found nothing better.
    for (const token of parsed.expanded) {
      if (parsed.tokens.includes(token)) continue;
      for (const f of prepared) {
        if (f.text && f.text.split(" ").some((w) => fold(w) === token)) score += f.weight;
      }
    }
    return score > 0 ? Math.min(score, LOOSE_MATCH_MAX) : 0;
  }

  return score;
}

/** Sort by score, then by recency, then alphabetically — stable and explainable. */
export function rankHits(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    // Every direct match outranks every loose one, whatever the raw scores.
    if (a.loose !== b.loose) return a.loose ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    const at = a.created_at ? Date.parse(a.created_at) : 0;
    const bt = b.created_at ? Date.parse(b.created_at) : 0;
    if (Number.isFinite(bt) && Number.isFinite(at) && bt !== at) return bt - at;
    return a.title.localeCompare(b.title);
  });
}

export function isLoose(score: number): boolean {
  return score > 0 && score <= LOOSE_MATCH_MAX;
}

export function countByKind(hits: SearchHit[]): Record<SearchKind, number> {
  const counts = {
    need: 0,
    event: 0,
    service: 0,
    tool: 0,
    pantry: 0,
    place: 0,
    community: 0,
    neighbor: 0,
  } as Record<SearchKind, number>;
  for (const h of hits) counts[h.kind] += 1;
  return counts;
}

export type SearchDoor = {
  id: string;
  title: string;
  why: string;
  href: string;
  external?: boolean;
};

/**
 * Doors: existing pages that answer the query even when no row matched.
 *
 * A small-town board is often genuinely empty on a given subject. Rather than a
 * dead end, point at the real page that can help — and never dress a door up as
 * a listing.
 */
export function suggestDoors(parsed: ParsedQuery, opts: { slug?: string } = {}): SearchDoor[] {
  const doors: SearchDoor[] = [];
  const has = (...words: string[]) =>
    words.some((w) => parsed.tokens.includes(fold(w)) || parsed.normalized.includes(w));
  const slug = opts.slug || "vidalia";

  if (parsed.zip) {
    doors.push({
      id: "near-zip",
      title: `Look up ${parsed.zip}`,
      why: "Find the town for that ZIP and open its board.",
      href: `/near?q=${parsed.zip}`,
    });
  }

  if (has("pantry", "pantries", "food", "groceries", "grocery", "hungry", "meal", "meals")) {
    doors.push({
      id: "pantries",
      title: "Food pantries on the Vidalia board",
      why: "Every pantry listing neighbors have added for Toombs County, with hours and what to bring.",
      href: `/c/${slug}?tab=places&cat=pantry`,
    });
    doors.push({
      id: "cc-get-help",
      title: "ChurchConnect — Get Help",
      why: "Church food assistance lives there. Neighborly does not copy that directory.",
      href: "https://churchconnect.unitedundergod.org/get-help",
      external: true,
    });
  }

  if (has("church", "bible", "study", "ministry", "worship", "prayer", "faith", "fellowship", "group")) {
    doors.push({
      id: "ministry",
      title: "Bible studies, ministry & ways to serve",
      why: "Gatherings and volunteer openings neighbors have actually posted, plus how to start one.",
      href: `/ministry?place=${slug}`,
    });
    doors.push({
      id: "churches",
      title: "Churches near you",
      why: "Public church records — service times, ministries, and how to reach them.",
      href: "/churches?zip=30474",
    });
  }

  if (has("weekend", "today", "tonight", "saturday", "sunday", "friday", "event", "events", "happening")) {
    doors.push({
      id: "weekend",
      title: "This weekend",
      why: "Weather plus what is actually on the public calendars.",
      href: `/weekend?place=${slug}`,
    });
  }

  if (has("tool", "tools", "borrow", "lend", "mower", "trailer", "ladder", "drill")) {
    doors.push({
      id: "tools",
      title: "Tools neighbors will lend",
      why: "Borrow what is listed, or list what you own.",
      href: `/c/${slug}?tab=tools`,
    });
  }

  if (has("help", "need", "volunteer", "serve")) {
    doors.push({
      id: "needs",
      title: "Post or answer a need",
      why: "Ask for a real hand — or take one that is already posted.",
      href: `/c/${slug}?tab=needs`,
    });
  }

  return doors;
}

/**
 * Split text into matched / unmatched runs so the UI can highlight why a row
 * came back. Only the words the neighbor typed are highlighted.
 */
export function highlightParts(
  text: string,
  parsed: ParsedQuery,
): { text: string; hit: boolean }[] {
  const needles = [...parsed.phrases, ...parsed.tokens].filter((n) => n.length > 1);
  if (!text || needles.length === 0) return [{ text, hit: false }];

  const escaped = needles
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");

  return text
    .split(re)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, hit: re.test(part) && needles.includes(part.toLowerCase()) }));
}

/** Example searches shown when the box is empty — all real doors in this app. */
export const SEARCH_EXAMPLES = [
  "food pantry",
  "bible study",
  "pickleball",
  "help with my yard",
  "borrow a mower",
  "kids activities",
];
