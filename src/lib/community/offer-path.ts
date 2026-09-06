/** Deep-link after signup / onboarding so Offer lands on the existing register form. */
export const OFFER_SERVICE_PATH = "/app/services" as const;

export function isSafeNext(raw?: string | null): raw is string {
  if (!raw) return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.includes("://")) return false;
  return raw.length < 180;
}

export function isOfferServiceNext(raw?: string | null): boolean {
  return !!raw && raw.split("?")[0] === OFFER_SERVICE_PATH;
}

export function offerSignupSearch(opts?: {
  community?: string;
  code?: string;
  next?: string;
}) {
  return {
    community: opts?.community ?? "vidalia",
    code: opts?.code ?? "VIDALIA-WELCOME",
    next: opts?.next ?? OFFER_SERVICE_PATH,
  };
}

export type JoinDestination =
  | { to: "/app/services" }
  | { to: "/app" }
  | { to: "/c/$slug"; params: { slug: string }; search: { tab?: string; cat?: string } };

export function destinationAfterJoin(next?: string | null): JoinDestination {
  if (isOfferServiceNext(next)) return { to: "/app/services" };
  if (isSafeNext(next) && next.startsWith("/c/")) {
    const [path, qs] = next.split("?");
    const slug = path.replace(/^\/c\//, "").split("/")[0];
    if (slug && /^[a-z0-9-]+$/.test(slug)) {
      const params = new URLSearchParams(qs || "");
      return {
        to: "/c/$slug",
        params: { slug },
        search: {
          tab: params.get("tab") || undefined,
          cat: params.get("cat") || undefined,
        },
      };
    }
  }
  return { to: "/app" };
}
