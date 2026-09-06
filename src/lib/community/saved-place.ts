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
    return;
  }
  window.localStorage.setItem(SAVED_PLACE_KEY, JSON.stringify(place));
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
