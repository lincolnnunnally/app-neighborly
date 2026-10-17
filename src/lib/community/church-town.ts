/** The town a /churches page is about, for its heading ("Churches near Covington"). */
import { createServerFn } from "@tanstack/react-start";
import { loadSavedPlace } from "./place-cookie";

export type ChurchTown = { city: string; state: string } | null;

/** ZIP → town name (the same ZIP lookup the town search uses). */
export const townForZip = createServerFn({ method: "GET" })
  .validator((input: { zip: string }) => input)
  .handler(async ({ data }): Promise<ChurchTown> => {
    if (!/^\d{5}$/.test(data.zip)) return null;
    const { geocodeQuery } = await import("./place");
    const geo = await geocodeQuery(data.zip).catch(() => null);
    return geo?.city ? { city: geo.city, state: geo.state } : null;
  });

/**
 * Pure order of preference: a city in the URL, the town for the URL's ZIP (the
 * saved place when it's the same ZIP, so no lookup), then the saved place.
 * Null when no place is set: the page keeps "Churches near you".
 */
export async function resolveChurchTown(
  search: { zip?: string; city?: string; state?: string },
  deps: { saved: () => Promise<{ zip: string; city: string; state: string } | null>; lookupZip: (zip: string) => Promise<ChurchTown> },
): Promise<ChurchTown> {
  if (search.city) return { city: search.city, state: search.state || "" };
  const saved = await deps.saved().catch(() => null);
  if (search.zip) {
    if (saved?.zip === search.zip && saved.city) return { city: saved.city, state: saved.state };
    return deps.lookupZip(search.zip).catch(() => null);
  }
  return saved?.city ? { city: saved.city, state: saved.state } : null;
}

export function loadChurchTown(search: { zip?: string; city?: string; state?: string }): Promise<ChurchTown> {
  return resolveChurchTown(search, {
    saved: loadSavedPlace,
    lookupZip: (zip) => townForZip({ data: { zip } }),
  });
}
