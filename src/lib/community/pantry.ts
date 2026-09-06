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

export function pantryServeLine(
  place: Pick<Facility, "serve_days" | "serve_times">,
): string {
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
