import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { eventStartIso } from "./board-events";
import { isPantry, pantryAddressLine, pantryServeLine } from "./pantry";
import { blockedUserIds } from "./safety";
import { ensureSeeded } from "./seed";
import {
  countByKind,
  isLoose,
  parseQuery,
  rankHits,
  scoreFields,
  suggestDoors,
  type SearchHit,
  type SearchKind,
  type SearchScope,
} from "./search";
import { serviceCategoryLabel, toolCategoryLabel } from "./types";

/**
 * Cross-board free-text search.
 *
 * The DB pass is deliberately a wide, cheap net: one parameterized `like` per
 * expanded term over a concatenated haystack of the row's real text columns.
 * Relevance is then decided in JS by scoreFields() so the board's client-side
 * filter and this server ranking agree word for word.
 *
 * `lower(...) like $n` (not `ilike`, not `to_tsvector`) is used on purpose —
 * it behaves identically on the LPL Supabase Postgres and the embedded PGLite
 * preview, with no extension to install.
 */

async function db() {
  const sql = await getSql();
  await ensureSeeded(sql);
  return sql;
}

/** Cap per entity before scoring — a small-town board never gets near this. */
const SCAN_LIMIT = 300;
/** Cap returned to the client. */
const RESULT_LIMIT = 120;

type Clause = { text: string; params: unknown[] };

/**
 * OR-of-likes across a concatenated haystack, parameterized. Callers pass the
 * next free placeholder index so several clauses can share one statement.
 */
function haystackClause(columns: string[], terms: string[], nextParam: number): Clause {
  const haystack = columns.map((c) => `coalesce(${c}::text, '')`).join(" || ' ' || ");
  const parts = terms.map((_, i) => `lower(${haystack}) like $${nextParam + i}`);
  return {
    text: `(${parts.join(" or ")})`,
    params: terms.map((t) => `%${t.toLowerCase()}%`),
  };
}

function snippet(text: string, max = 180): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export type SearchResponse = {
  query: string;
  hits: SearchHit[];
  counts: Record<SearchKind, number>;
  /** Hits that matched a word actually typed, as opposed to a synonym. */
  directCount: number;
  doors: ReturnType<typeof suggestDoors>;
  /** True when the query was blank — the UI shows examples instead of "no results". */
  empty: boolean;
  scope: SearchScope;
  slug: string;
};

export const searchNeighborly = createServerFn({ method: "GET" })
  .validator(
    (input: { q: string; slug?: string; scope?: string; userId?: string }) => input,
  )
  .handler(async ({ data }): Promise<SearchResponse> => {
    const parsed = parseQuery(data.q ?? "");
    const scope = (data.scope ?? "all") as SearchScope;
    const slug = (data.slug ?? "").trim();

    if (parsed.isEmpty) {
      return {
        query: parsed.raw,
        hits: [],
        counts: countByKind([]),
        directCount: 0,
        doors: [],
        empty: true,
        scope,
        slug,
      };
    }

    const sql = await db();
    const terms = parsed.expanded.length ? parsed.expanded : parsed.tokens;
    const wants = (kind: SearchKind) => scope === "all" || scope === kind;

    // A slug narrows the search to one board; without it we search every board,
    // which is what "search for whatever you're looking for" has to mean.
    const scopeSql = slug ? " and c.slug = $1" : "";
    const scopeParams: unknown[] = slug ? [slug] : [];
    const firstTermParam = scopeParams.length + 1;

    async function run(
      table: string,
      alias: string,
      columns: string[],
      extraWhere = "",
      order = `${alias}.created_at desc`,
    ): Promise<Record<string, unknown>[]> {
      const clause = haystackClause(columns, terms, firstTermParam);
      const text = `
        select ${alias}.*, c.slug as community_slug, c.name as community_name, c.city as community_city
        from ${table} ${alias}
        join communities c on c.id = ${alias}.community_id
        where ${clause.text}${scopeSql}${extraWhere ? ` and ${extraWhere}` : ""}
        order by ${order}
        limit ${SCAN_LIMIT}
      `;
      try {
        return await sql.query<Record<string, unknown>>(text, [...scopeParams, ...clause.params]);
      } catch {
        // A table that a migration has not created yet (tools shipped later)
        // must not take the whole search down.
        return [];
      }
    }

    const hits: SearchHit[] = [];
    const push = (
      hit: Omit<SearchHit, "score" | "loose">,
      fields: Parameters<typeof scoreFields>[1],
    ) => {
      const score = scoreFields(parsed, fields);
      if (score > 0) hits.push({ ...hit, score, loose: isLoose(score) });
    };

    // ── Needs ────────────────────────────────────────────────────────────────
    if (wants("need")) {
      const rows = await run("needs", "n", [
        "n.title",
        "n.description",
        "n.category",
        "n.urgency",
        "n.author_name",
      ]);
      for (const r of rows) {
        const status = String(r.status ?? "");
        push(
          {
            id: String(r.id),
            kind: "need",
            title: String(r.title ?? ""),
            snippet: snippet(String(r.description ?? "")),
            meta: [String(r.category ?? ""), String(r.urgency ?? ""), status]
              .filter(Boolean)
              .join(" · "),
            badges: [status === "open" ? "Open" : status, String(r.urgency ?? "")].filter(Boolean),
            href: `/c/${String(r.community_slug)}?tab=needs`,
            community_slug: String(r.community_slug),
            community_name: String(r.community_name),
            created_at: String(r.created_at ?? ""),
          },
          [
            { text: String(r.title ?? ""), weight: 3 },
            { text: String(r.category ?? ""), weight: 2 },
            { text: String(r.description ?? ""), weight: 1 },
            { text: String(r.author_name ?? ""), weight: 1 },
          ],
        );
      }
    }

    // ── Events (this is also where Bible studies / ministry gatherings live) ──
    if (wants("event")) {
      const rows = await run("events", "e", [
        "e.title",
        "e.description",
        "e.kind",
        "e.location",
        "e.host_name",
      ], "", "e.starts_at asc");
      for (const r of rows) {
        push(
          {
            id: String(r.id),
            kind: "event",
            title: String(r.title ?? ""),
            snippet: snippet(String(r.description ?? "")),
            meta: [String(r.location ?? ""), String(r.host_name ?? "")].filter(Boolean).join(" · "),
            badges: [String(r.kind ?? "")].filter(Boolean),
            href: `/c/${String(r.community_slug)}?tab=events`,
            community_slug: String(r.community_slug),
            community_name: String(r.community_name),
            created_at: eventStartIso(r.starts_at),
          },
          [
            { text: String(r.title ?? ""), weight: 3 },
            { text: String(r.kind ?? ""), weight: 2 },
            { text: String(r.location ?? ""), weight: 2 },
            { text: String(r.description ?? ""), weight: 1 },
            { text: String(r.host_name ?? ""), weight: 1 },
          ],
        );
      }
    }

    // ── Services ─────────────────────────────────────────────────────────────
    if (wants("service")) {
      const rows = await run("services", "s", [
        "s.title",
        "s.description",
        "s.category",
        "s.provider_name",
        "s.maker_bio",
        "s.price_note",
      ]);
      for (const r of rows) {
        const category = String(r.category ?? "");
        push(
          {
            id: String(r.id),
            kind: "service",
            title: String(r.title ?? ""),
            snippet: snippet(String(r.description ?? "")),
            meta: [serviceCategoryLabel(category), String(r.provider_name ?? "")]
              .filter(Boolean)
              .join(" · "),
            badges: [
              r.is_youth ? "Youth" : "",
              r.is_business ? "Business" : "",
              String(r.pricing ?? ""),
            ].filter(Boolean),
            href: `/c/${String(r.community_slug)}?tab=services&cat=${category}`,
            community_slug: String(r.community_slug),
            community_name: String(r.community_name),
            created_at: String(r.created_at ?? ""),
          },
          [
            { text: String(r.title ?? ""), weight: 3 },
            { text: serviceCategoryLabel(category), weight: 2 },
            { text: String(r.description ?? ""), weight: 1 },
            { text: String(r.maker_bio ?? ""), weight: 1 },
            { text: String(r.provider_name ?? ""), weight: 1 },
          ],
        );
      }
    }

    // ── Tools ────────────────────────────────────────────────────────────────
    if (wants("tool")) {
      const rows = await run(
        "tools",
        "t",
        ["t.title", "t.description", "t.category", "t.owner_name", "t.condition"],
        "t.status = 'listed'",
      );
      for (const r of rows) {
        const category = String(r.category ?? "");
        push(
          {
            id: String(r.id),
            kind: "tool",
            title: String(r.title ?? ""),
            snippet: snippet(String(r.description ?? "")),
            meta: [toolCategoryLabel(category), String(r.owner_name ?? "")]
              .filter(Boolean)
              .join(" · "),
            badges: [r.runs_ready ? "Ready" : "Not ready"],
            href: `/c/${String(r.community_slug)}?tab=tools&cat=${category}`,
            community_slug: String(r.community_slug),
            community_name: String(r.community_name),
            created_at: String(r.created_at ?? ""),
          },
          [
            { text: String(r.title ?? ""), weight: 3 },
            { text: toolCategoryLabel(category), weight: 2 },
            { text: String(r.description ?? ""), weight: 1 },
            { text: String(r.owner_name ?? ""), weight: 1 },
          ],
        );
      }
    }

    // ── Places: pantries and reservable rooms ────────────────────────────────
    if (wants("pantry") || wants("place")) {
      const rows = await run(
        "facilities",
        "f",
        [
          "f.name",
          "f.description",
          "f.address",
          "f.city",
          "f.zip",
          "f.serve_days",
          "f.serve_times",
          "f.residency_note",
          "f.other_notes",
          "f.amenities",
          "f.rate_note",
          "f.contact_name",
          "f.place_kind",
        ],
        "",
        "f.name asc",
      );
      for (const r of rows) {
        const pantry = isPantry({ place_kind: String(r.place_kind ?? "reserve") as "pantry" | "reserve" });
        const kind: SearchKind = pantry ? "pantry" : "place";
        if (!wants(kind)) continue;
        const address = pantryAddressLine({
          address: String(r.address ?? ""),
          city: String(r.city ?? ""),
          zip: String(r.zip ?? ""),
        });
        const serve = pantryServeLine({
          serve_days: String(r.serve_days ?? ""),
          serve_times: String(r.serve_times ?? ""),
        });
        push(
          {
            id: String(r.id),
            kind,
            title: String(r.name ?? ""),
            snippet: snippet(String(r.description ?? "")),
            meta: pantry
              ? [address, serve].filter(Boolean).join(" · ")
              : [String(r.rate_note ?? ""), String(r.contact_name ?? "")].filter(Boolean).join(" · "),
            badges: pantry
              ? ["Food pantry", String(r.city ?? "")].filter(Boolean)
              : ["Reservable", ...parseJsonArray(String(r.amenities ?? "[]")).slice(0, 2)],
            href: `/c/${String(r.community_slug)}?tab=places&cat=${pantry ? "pantry" : "reserve"}`,
            community_slug: String(r.community_slug),
            community_name: String(r.community_name),
          },
          [
            { text: String(r.name ?? ""), weight: 3 },
            // A pantry must be findable by the words "food pantry" even when
            // its real name is "First Baptist Benevolence Closet".
            { text: pantry ? "food pantry groceries" : "reservable room facility", weight: 2 },
            { text: String(r.city ?? ""), weight: 2 },
            { text: String(r.description ?? ""), weight: 1 },
            { text: address, weight: 1 },
            { text: String(r.other_notes ?? ""), weight: 1 },
            { text: parseJsonArray(String(r.amenities ?? "[]")).join(" "), weight: 1 },
          ],
        );
      }
    }

    // ── Communities / groups ─────────────────────────────────────────────────
    if (wants("community")) {
      const clause = haystackClause(
        ["c.name", "c.tagline", "c.description", "c.city", "c.state", "c.slug", "c.kind"],
        terms,
        firstTermParam,
      );
      try {
        const rows = await sql.query<Record<string, unknown>>(
          `select c.* from communities c where ${clause.text}${slug ? " and c.slug = $1" : ""} order by c.is_featured desc, c.name asc limit ${SCAN_LIMIT}`,
          [...scopeParams, ...clause.params],
        );
        for (const r of rows) {
          push(
            {
              id: String(r.id),
              kind: "community",
              title: String(r.name ?? ""),
              snippet: snippet(String(r.tagline ?? r.description ?? "")),
              meta: [String(r.city ?? ""), String(r.state ?? "")].filter(Boolean).join(", "),
              badges: [String(r.kind ?? "")].filter(Boolean),
              href: `/c/${String(r.slug)}`,
              community_slug: String(r.slug),
              community_name: String(r.name ?? ""),
            },
            [
              { text: String(r.name ?? ""), weight: 3 },
              { text: String(r.kind ?? ""), weight: 2 },
              { text: String(r.tagline ?? ""), weight: 2 },
              { text: String(r.city ?? ""), weight: 2 },
              { text: String(r.description ?? ""), weight: 1 },
            ],
          );
        }
      } catch {
        /* communities table is always present; ignore a transient failure */
      }
    }

    // ── Neighbors ────────────────────────────────────────────────────────────
    // Only for signed-in neighbors, and only inside boards they actually belong
    // to. A stranger typing a skill should not get a roster of names.
    if (wants("neighbor") && data.userId) {
      // This query has its own placeholder layout: $1 is always the viewer's
      // user id, so the term placeholders start at $2 (not at firstTermParam).
      const clause = haystackClause(
        ["p.display_name", "p.bio", "p.skills", "p.help_offerings", "p.interests"],
        terms,
        2,
      );
      const params: unknown[] = [data.userId, ...clause.params];
      let where = clause.text;
      if (slug) {
        params.push(slug);
        where += ` and c.slug = $${params.length}`;
      }
      try {
        const rows = await sql.query<Record<string, unknown>>(
          `select distinct p.user_id, p.display_name, p.bio, p.skills, p.help_offerings,
                  p.interests, p.street_hint, c.slug as community_slug, c.name as community_name
           from profiles p
           join memberships m on m.user_id = p.user_id and m.status = 'active'
           join communities c on c.id = m.community_id
           join memberships mine on mine.community_id = m.community_id
                and mine.user_id = $1 and mine.status = 'active'
           where ${where}
           limit ${SCAN_LIMIT}`,
          params,
        );
        const hidden = await blockedUserIds(data.userId);
        for (const r of rows) {
          const userId = String(r.user_id);
          if (hidden.has(userId) || userId === data.userId) continue;
          const skills = parseJsonArray(String(r.skills ?? "[]"));
          const offers = parseJsonArray(String(r.help_offerings ?? "[]"));
          push(
            {
              id: userId,
              kind: "neighbor",
              title: String(r.display_name ?? ""),
              snippet: snippet(String(r.bio ?? "")),
              meta: [...skills, ...offers].slice(0, 4).join(" · "),
              badges: skills.slice(0, 2),
              href: "/app/neighbors",
              community_slug: String(r.community_slug),
              community_name: String(r.community_name),
            },
            [
              { text: String(r.display_name ?? ""), weight: 3 },
              { text: skills.join(" "), weight: 2 },
              { text: offers.join(" "), weight: 2 },
              { text: parseJsonArray(String(r.interests ?? "[]")).join(" "), weight: 2 },
              { text: String(r.bio ?? ""), weight: 1 },
            ],
          );
        }
      } catch {
        /* profile search is a bonus — never fail the whole search on it */
      }
    }

    const ranked = rankHits(hits).slice(0, RESULT_LIMIT);

    return {
      query: parsed.raw,
      hits: ranked,
      counts: countByKind(ranked.filter((h) => !h.loose)),
      directCount: ranked.filter((h) => !h.loose).length,
      doors: suggestDoors(parsed, { slug: slug || undefined }),
      empty: false,
      scope,
      slug,
    };
  });
