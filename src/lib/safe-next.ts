/**
 * One validator for every "send me back here after sign-in" value
 * (`next`, `redirect`, OAuth callback). Only same-origin, path-only values
 * pass: no scheme, no protocol-relative `//host`, no backslash tricks, no
 * control characters.
 */
export function isSafeNext(raw?: unknown): raw is string {
  if (typeof raw !== "string" || !raw) return false;
  if (raw.length > 300) return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return false;
  if (raw.includes("://") || raw.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return false;
  return true;
}

export function safeNext(raw?: unknown, fallback = "/app"): string {
  return isSafeNext(raw) ? raw : fallback;
}

/** Search-param reader: keeps only a safe value, else undefined. */
export function readNext(raw?: unknown): string | undefined {
  return isSafeNext(raw) ? raw : undefined;
}

/** An event page is a place we can return to straight after sign-up. */
export function isEventNext(raw?: unknown): raw is string {
  return isSafeNext(raw) && raw.startsWith("/e/");
}
