/** Distance choices for the weekend feed. Pure, safe to import in the browser. */

/** 15 = nearby towns, 30 = the next county over, 60 = about an hour's drive. */
export const RADIUS_CHOICES = [15, 30, 60] as const;
export const DEFAULT_RADIUS_MI = 60;
/** "Worth the drive" reaches past the chosen radius out to here. */
export const WORTH_THE_DRIVE_MI = 100;

export function normalizeRadius(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS_MI;
  return Math.min(150, Math.max(5, Math.round(n)));
}

/** How far the "worth the drive" ring reaches: past the radius, out to ~100 mi. */
export function wideRadiusFor(radiusMi: number): number {
  return Math.min(150, Math.max(WORTH_THE_DRIVE_MI, Math.round(radiusMi)));
}
