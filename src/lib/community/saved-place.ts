/** Guest + signed-in home place. Profile wins when signed in; localStorage for guests. */

export const SAVED_PLACE_KEY = "neighborly.homePlace";

export type SavedPlace = {
  zip: string;
  city: string;
  state: string;
  label: string;
  lat?: number | null;
  lon?: number | null;
  slug?: string;
};

export function readSavedPlace(): SavedPlace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_PLACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlace;
    if (!parsed || (!parsed.zip && !parsed.city)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSavedPlace(place: SavedPlace | null): void {
  if (typeof window === "undefined") return;
  if (!place) {
    window.localStorage.removeItem(SAVED_PLACE_KEY);
    document.cookie = `${PLACE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  window.localStorage.setItem(SAVED_PLACE_KEY, JSON.stringify(place));
  writePlaceCookie(place);
}

/**
 * The same place in a small cookie, so the server renders the visitor's town on
 * bare / (localStorage alone would paint Vidalia first, then switch).
 */
export const PLACE_COOKIE = "neighborly_place";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const PLACE_COOKIE_MAX_AGE = COOKIE_MAX_AGE;

/** Pure: the JSON stored in the cookie (server and client write the same shape). */
export function placeCookieJson(place: { zip: string; city: string; state: string; slug?: string }): string {
  return JSON.stringify({ zip: place.zip, city: place.city, state: place.state, slug: place.slug || "" });
}

export function writePlaceCookie(place: SavedPlace): void {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(placeCookieJson(place));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PLACE_COOKIE}=${v}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Pure: a cookie value (raw or URI-encoded JSON) → a saved place, or null. */
export function parsePlaceCookie(raw: string | null | undefined): SavedPlace | null {
  if (!raw) return null;
  try {
    let text = raw;
    if (!text.trim().startsWith("{")) text = decodeURIComponent(text);
    const o = JSON.parse(text) as Partial<SavedPlace>;
    const zip = typeof o.zip === "string" && /^\d{5}$/.test(o.zip) ? o.zip : "";
    const city = typeof o.city === "string" ? o.city.slice(0, 80) : "";
    if (!zip && !city) return null;
    const state = typeof o.state === "string" ? o.state.slice(0, 2) : "";
    const slug = typeof o.slug === "string" && /^[a-z0-9-]{1,80}$/.test(o.slug) ? o.slug : undefined;
    return { zip, city, state, label: [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : ""), slug };
  } catch {
    return null;
  }
}

/** Client: the place cookie from document.cookie. */
export function readPlaceCookie(): SavedPlace | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${PLACE_COOKIE}=([^;]*)`));
  return parsePlaceCookie(m?.[1]);
}

export function labelForPlace(place: {
  city?: string;
  state?: string;
  zip?: string;
  name?: string;
}): string {
  const city = (place.city || place.name || "").trim();
  const state = (place.state || "").trim();
  const zip = (place.zip || "").trim();
  if (city && state && zip) return `${city}, ${state} ${zip}`;
  if (city && state) return `${city}, ${state}`;
  if (zip) return zip;
  return city || "your town";
}
