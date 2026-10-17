import { useEffect } from "react";
import { readPlaceCookie, readSavedPlace, writePlaceCookie, writeSavedPlace } from "./saved-place";

type PlanPlace = { slug: string; name: string; city: string; state: string; zip: string; board: boolean };

/**
 * Save the town a page was opened for (a ?zip=/?q=/?place= URL) as the
 * visitor's place: localStorage plus the cookie the server reads on bare /.
 * Pass null to only carry an older localStorage-only save over to the cookie.
 */
export function useRememberPlace(plan: { place: PlanPlace } | null | undefined) {
  const p = plan?.place;
  const key = p ? `${p.slug}|${p.zip}|${p.city}` : "";
  useEffect(() => {
    if (p && (p.zip || p.city)) {
      const city = p.city || p.name;
      writeSavedPlace({
        zip: p.zip,
        city,
        state: p.state,
        label: [city, p.state].filter(Boolean).join(", ") + (p.zip ? ` ${p.zip}` : ""),
        slug: p.board ? p.slug : undefined,
      });
      return;
    }
    // Saved before the cookie existed: copy it so the next server render has it.
    if (!readPlaceCookie()) {
      const legacy = readSavedPlace();
      if (legacy) writePlaceCookie(legacy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
