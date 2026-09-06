import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Keep leftover walk URLs as `?zip=30474` / `?place=vidalia`, not JSON-quoted. */
function parseSearch(search: string): Record<string, string> {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const out: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(q)) {
    if (!value) {
      out[key] = value;
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      value === "true" ||
      value === "false" ||
      /^-?\d+(\.\d+)?$/.test(value)
    ) {
      try {
        const parsed = JSON.parse(value) as unknown;
        out[key] = parsed == null ? "" : String(parsed);
        continue;
      } catch {
        /* keep raw */
      }
    }
    out[key] = value;
  }
  return out;
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    parseSearch,
    stringifySearch,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
