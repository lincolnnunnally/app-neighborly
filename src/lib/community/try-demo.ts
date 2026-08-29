import { authClient } from "@/lib/auth/client";
import {
  joinCommunities,
  listCommunities,
  resolveInvite,
  upsertProfile,
} from "@/lib/community/server";

/**
 * One-click working session: creates a real account, profile, and joins Milstead
 * (plus optional invite community). Used so every button can be exercised without
 * a multi-step form first.
 */
export async function startDemoNeighbor(opts?: {
  displayName?: string;
  code?: string;
  isNew?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const stamp = Date.now().toString(36);
  const email = `neighbor_${stamp}@neighborly.demo`;
  const password = `Neighborly!${stamp}`;
  const name = opts?.displayName?.trim() || `Neighbor ${stamp.slice(-4).toUpperCase()}`;

  try {
    const existing = await authClient.getSession();
    if (!existing.data?.user) {
      const signedUp = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (signedUp.error) {
        // Fallback: try sign-in in case of race
        const signedIn = await authClient.signIn.email({ email, password });
        if (signedIn.error) {
          return { ok: false, error: signedUp.error.message ?? "Could not start demo" };
        }
      }
    }

    await upsertProfile({
      data: {
        display_name: name,
        bio: "Neighbor trying Neighborly — happy to help where I can.",
        street_hint: "Vidalia area",
        skills: ["Handyman", "Yard work", "Errands", "Moving help"].slice(0, 3),
        help_offerings: ["Handyman", "Yard work", "Errands"],
        interests: ["Block parties", "Community cleanups", "Kids activities"],
        is_new_resident: Boolean(opts?.isNew),
        notify_events: true,
        notify_needs: true,
        notify_services: true,
        notify_facilities: true,
        welcome_seen: true,
      },
    });

    const communities = await listCommunities();
    const vidalia = communities.find((c) => c.slug === "vidalia");
    const milstead = communities.find((c) => c.slug === "milstead");
    const ids: string[] = [];
    if (vidalia) ids.push(vidalia.id);
    if (milstead && !ids.includes(milstead.id)) ids.push(milstead.id);

    if (opts?.code) {
      const inv = await resolveInvite({ data: opts.code });
      if (inv?.community && !ids.includes(inv.community.id)) {
        ids.push(inv.community.id);
      }
    }

    if (ids.length === 0) {
      return { ok: false, error: "No communities available yet" };
    }

    await joinCommunities({
      data: {
        communityIds: ids,
        primaryId: ids[0],
        joinedVia: opts?.code ? "invite" : "browse",
        inviteCode: opts?.code ?? "VIDALIA-WELCOME",
      },
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start Neighborly",
    };
  }
}
