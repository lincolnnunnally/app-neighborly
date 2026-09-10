import { CC_GET_HELP } from "./churches";
import type { Facility, PlaceKind } from "./types";

export const PLACE_KIND_PANTRY: PlaceKind = "pantry";
export const PLACE_KIND_RESERVE: PlaceKind = "reserve";

export { CC_GET_HELP };

const ZIP_RE = /^\d{5}$/;

export function isPantry(place: Pick<Facility, "place_kind">): boolean {
  return place.place_kind === PLACE_KIND_PANTRY;
}

export function placeKindLabel(kind: string): string {
  return kind === PLACE_KIND_PANTRY ? "Food pantry" : "Reservable place";
}

export function pantryCityLine(place: Pick<Facility, "city" | "zip">): string {
  return [place.city, place.zip].filter(Boolean).join(" ");
}

export function pantryAddressLine(
  place: Pick<Facility, "address" | "city" | "zip">,
): string {
  const cityZip = pantryCityLine(place);
  return [place.address, cityZip].filter(Boolean).join(", ");
}

/** Turn-by-turn directions. iPhone will offer Apple Maps. */
export function pantryMapsDirUrl(
  place: Pick<Facility, "address" | "city" | "zip"> & { lat?: number | null; lon?: number | null },
): string {
  if (place.lat != null && place.lon != null && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
  }
  const q = pantryAddressLine(place);
  if (!q) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export const TOOMBS_PANTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  pantry_pub_vidalia_church_of_god: { lat: 32.216416, lon: -82.417518 },
  pantry_pub_gods_storehouse: { lat: 32.187831, lon: -82.408712 },
  pantry_pub_his_works: { lat: 32.203209, lon: -82.31975 },
  pantry_pub_concerted_services: { lat: 32.203286, lon: -82.373271 },
  pantry_pub_segcp: { lat: 32.198511, lon: -82.320815 },
  pantry_pub_solomon_tabernacle: { lat: 32.227602, lon: -82.409263 },
  pantry_pub_boys_girls_club: { lat: 32.211105, lon: -82.404859 },
  pantry_pub_toombs_farmers_market: { lat: 32.205552, lon: -82.328209 },
};

export function coordsForPantry(id: string) {
  return TOOMBS_PANTRY_COORDS[id] || null;
}

export function pantryServeLine(
  place: Pick<Facility, "serve_days" | "serve_times"> &
    Partial<Pick<Facility, "amenities" | "other_notes">>,
): string {
  if (isClosedListing(place)) return "Do not go — closed or moved.";
  const days = place.serve_days.trim();
  const times = place.serve_times.trim();
  if (days && times) return `${days} · ${times}`;
  return days || times || "Hours not listed — confirm before you go.";
}

export function fieldOrUnlisted(value: string): string {
  const trimmed = value.trim();
  return trimmed || "Not listed";
}

export function isToombsAreaZip(zip: string): boolean {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  return z.startsWith("304");
}

export function normalizePantryZip(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

export function isValidPantryZip(zip: string): boolean {
  return ZIP_RE.test(normalizePantryZip(zip));
}

export function normalizeWebsite(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function isSafeWebsite(raw: string): boolean {
  if (!raw.trim()) return true;
  try {
    const url = new URL(normalizeWebsite(raw));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A row published from a public source rather than added by a neighbor. */
export const PUBLIC_LISTING_NAME = "Public listing";

export function isPublicListing(
  place: Pick<Facility, "listed_by" | "listed_by_name">,
): boolean {
  return place.listed_by === "system" || place.listed_by_name === PUBLIC_LISTING_NAME;
}

/**
 * A public listing nobody local has claimed or checked yet. Transcribed from a
 * directory, so it may be out of date — the card says so out loud.
 */
export function isUnconfirmedListing(
  place: Pick<Facility, "listed_by" | "listed_by_name" | "verified_on">,
): boolean {
  return isPublicListing(place) && !place.verified_on.trim();
}

export function isClosedListing(
  place: Partial<Pick<Facility, "amenities" | "other_notes">>,
): boolean {
  if ((place.amenities || []).some((a) => a.toLowerCase() === "closed")) return true;
  return /^\s*closed\b/i.test(place.other_notes || "");
}

/**
 * One line a neighbor can act on: who published this and when it was last read
 * off that source. Never claims a pantry was verified by us today.
 */
export function pantrySourceLine(
  place: Pick<Facility, "source_name" | "verified_on" | "listed_by_name">,
): string {
  const parts: string[] = [];
  if (place.source_name.trim()) parts.push(`From ${place.source_name.trim()}`);
  else if (place.listed_by_name.trim()) parts.push(`Listed by ${place.listed_by_name.trim()}`);
  if (place.verified_on.trim()) parts.push(`last checked ${place.verified_on.trim()}`);
  return parts.join(" · ");
}

/**
 * Hours change without notice and a wasted trip costs a hungry neighbor a tank
 * of gas. Every pantry card says this — the strength depends on what we know.
 */
export function pantryCallAheadNote(
  place: Pick<Facility, "serve_days" | "serve_times" | "phone"> &
    Partial<Pick<Facility, "amenities" | "other_notes">>,
): string {
  if (isClosedListing(place)) {
    return "A local visit found this pantry gone. Do not drive here expecting food.";
  }
  const hasHours = Boolean(place.serve_days.trim() || place.serve_times.trim());
  if (!hasHours) {
    return place.phone.trim()
      ? "Hours are not published anywhere we can cite — call before you go."
      : "Hours are not published anywhere we can cite. Check with the pantry before you go.";
  }
  return place.phone.trim()
    ? "Hours change without notice — call ahead to confirm."
    : "Hours change without notice — confirm before you go.";
}
