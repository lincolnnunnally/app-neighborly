/** Server-side read of the saved-place cookie, plus an isomorphic loader helper. */
import { createServerFn } from "@tanstack/react-start";
import { PLACE_COOKIE, parsePlaceCookie, readPlaceCookie, type SavedPlace } from "./saved-place";

export const getPlaceCookie = createServerFn({ method: "GET" }).handler(async (): Promise<SavedPlace | null> => {
  // Dynamic import keeps the server-only module out of the browser bundle.
  const { getCookie } = await import("@tanstack/react-start/server");
  return parsePlaceCookie(getCookie(PLACE_COOKIE));
});

/** In a loader: the cookie on the server, document.cookie in the browser (no round trip). */
export async function loadSavedPlace(): Promise<SavedPlace | null> {
  if (typeof document !== "undefined") return readPlaceCookie();
  try {
    return await getPlaceCookie();
  } catch {
    return null;
  }
}
