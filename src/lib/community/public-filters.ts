/**
 * Boards hidden from public lists (home, /communities, sitemap) until the owner
 * confirms them. The board itself is kept, not deleted.
 */
export const UNLISTED_COMMUNITY_SLUGS = new Set<string>(["lakeside-getaway"]);

/**
 * Members-only boards: signed-out visitors and non-members get a 404 on the
 * board, its invite link and its weekend view. Nothing is deleted.
 * To reopen a board, remove its slug here.
 */
export const MEMBERS_ONLY_COMMUNITY_SLUGS = new Set<string>(["lakeside-getaway"]);

export function isMembersOnlyCommunity(slug: string): boolean {
  return MEMBERS_ONLY_COMMUNITY_SLUGS.has(slug);
}

export function isListedCommunity(slug: string): boolean {
  return !UNLISTED_COMMUNITY_SLUGS.has(slug);
}

/** QA / smoke-test rows never show on a public board. */
const QA_TEXT = /^\s*(qa\b|qa[:\-_ ]|test\b|testing\b|\[test\]|smoke test)/i;

export function looksLikeQaRow(row: { title?: string; author_name?: string; host_name?: string; provider_name?: string; display_name?: string }): boolean {
  return [row.title, row.author_name, row.host_name, row.provider_name, row.display_name].some((v) => typeof v === "string" && QA_TEXT.test(v));
}
