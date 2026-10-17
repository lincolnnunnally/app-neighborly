/**
 * The town the visitor is looking at, for place-aware links (header, 404,
 * home): the place on the current page (home / weekend plan, a town board),
 * else the saved place (cookie, read by the root loader), else Vidalia.
 */
import { useRouterState } from "@tanstack/react-router";
import type { SavedPlace } from "./saved-place";

export type CurrentPlace = {
  city: string;
  state: string;
  zip: string;
  /** Board slug when the town has a Neighborly board, else "". */
  board: string;
  isVidalia: boolean;
};

export const VIDALIA: CurrentPlace = { city: "Vidalia", state: "GA", zip: "30474", board: "vidalia", isVidalia: true };

const vidaliaLike = (city: string, slug: string, zip: string) =>
  /^vidalia$/i.test(city) || slug === "vidalia" || slug.startsWith("vidalia-") || zip === "30474";

type PlanPlace = { slug: string; city: string; name: string; state: string; zip: string; board: boolean };
type BoardCommunity = { slug: string; city: string; state: string; zip?: string; kind: string };

export function placeFrom(p: { city?: string; state?: string; zip?: string; slug?: string; board?: boolean }): CurrentPlace {
  const city = p.city || "";
  const slug = p.slug || "";
  const zip = p.zip || "";
  if (vidaliaLike(city, slug, zip)) return VIDALIA;
  return { city: city || "your town", state: p.state || "", zip, board: p.board ? slug : "", isVidalia: false };
}

/** Pure: the place carried by the current route matches' loader data, if any. */
export function placeFromMatches(matches: { loaderData?: unknown }[]): CurrentPlace | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const d = matches[i].loaderData as
      | { plan?: { place?: PlanPlace } | null; community?: BoardCommunity | null; savedPlace?: SavedPlace | null }
      | undefined;
    const pl = d?.plan?.place;
    if (pl) return placeFrom({ city: pl.city || pl.name, state: pl.state, zip: pl.zip, slug: pl.slug, board: pl.board });
    const c = d?.community;
    // A town board (not a church or interest group under it) sets the town.
    if (c?.slug && c.kind === "neighborhood") return placeFrom({ city: c.city, state: c.state, zip: c.zip, slug: c.slug, board: true });
  }
  // Nothing on this page names a town: the saved one (root loader, from the cookie).
  for (const m of matches) {
    const sp = (m.loaderData as { savedPlace?: SavedPlace | null } | undefined)?.savedPlace;
    if (sp) return placeFrom({ city: sp.city, state: sp.state, zip: sp.zip, slug: sp.slug, board: Boolean(sp.slug) });
  }
  return null;
}

export function useCurrentPlace(): CurrentPlace {
  return useRouterState({ select: (s) => placeFromMatches(s.matches) }) ?? VIDALIA;
}

/** Header/board link: the town's own board, else a neutral label to the board list. */
export function boardLink(p: CurrentPlace): { label: string; slug: string | null } {
  if (p.board) return { label: `${p.city} board`, slug: p.board };
  return { label: "Neighbor board", slug: null };
}
