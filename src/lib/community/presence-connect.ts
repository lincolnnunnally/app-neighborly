import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

/** Presence Connect lives in Presence. Neighborly only shows a status + door. */
export const PRESENCE_CONNECT_URL = "https://presence.unitedundergod.org/connect";

export type PresenceConnectStatus = {
  /** null = no Presence account with this email (or lookup unavailable). */
  state: "on" | "off" | "expired" | null;
  openPlans: number;
};

/**
 * Read-only status for the signed-in neighbor, matched by email to the shared
 * LPL account. Uses public.presence_connect_status_by_email (SECURITY DEFINER,
 * server-only). Returns no location, names, or other people. Never throws:
 * the door still renders as a plain link if the lookup is unavailable.
 */
export const getPresenceConnectStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PresenceConnectStatus> => {
    try {
      const sql = await getSql();
      const users = await sql<{ email: string }>`
        select email from "user" where id = ${context.userId} limit 1
      `;
      const email = users[0]?.email;
      if (!email) return { state: null, openPlans: 0 };
      const rows = await sql<{ connect_on: boolean; expired: boolean; open_proposals: number }>`
        select connect_on, expired, open_proposals from public.presence_connect_status_by_email(${email})
      `;
      const r = rows[0];
      if (!r) return { state: null, openPlans: 0 };
      return {
        state: r.connect_on ? (r.expired ? "expired" : "on") : "off",
        openPlans: Number(r.open_proposals) || 0,
      };
    } catch {
      return { state: null, openPlans: 0 };
    }
  });
