/**
 * Free-form place input: "Vidalia GA 30474", "Vidalia, GA 30474", "30474",
 * "Vidalia, Georgia", "Vidalia GA". A ZIP anywhere in the text wins;
 * otherwise we keep a tidy "City, ST"-ish string for the city/state parser.
 */
export function normalizePlaceQuery(raw: unknown): string {
  const text = String(raw ?? "")
    .replace(/[\u00a0\s]+/g, " ")
    .trim();
  if (!text) return "";
  const zip = text.match(/(?:^|\D)(\d{5})(?:-\d{4})?(?!\d)/);
  if (zip) return zip[1];
  return text
    .replace(/,?\s*(usa|united states|us)\.?$/i, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[.;]+$/, "")
    .trim();
}
