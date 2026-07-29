import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyMemberships, getMyProfile } from "@/lib/community/server";
import { startDemoNeighbor } from "@/lib/community/try-demo";

/**
 * Ensures the visitor can perform neighbor actions. If signed out, starts a
 * real one-click demo account so buttons never dead-end. Does not navigate away
 * mid-action — callers keep going after session is ready.
 */
export function useRequireNeighbor() {
  const { user, isPending } = useCurrentUserState();

  async function ensureReady(opts?: { code?: string }): Promise<boolean> {
    if (isPending) return false;

    if (!user) {
      toast.message("Starting your neighbor session…");
      const res = await startDemoNeighbor({
        code: opts?.code ?? "MILSTEAD-WELCOME",
      });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      // Refresh client session so subsequent UI knows who we are
      await authClient.getSession();
      toast.success("You're in as a neighbor — action continues");
      return true;
    }

    try {
      const [profile, memberships] = await Promise.all([
        getMyProfile(),
        getMyMemberships(),
      ]);
      if (!profile || memberships.length === 0) {
        const res = await startDemoNeighbor({
          displayName: user.displayName ?? undefined,
          code: opts?.code ?? "MILSTEAD-WELCOME",
        });
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        await authClient.getSession();
      }
      return true;
    } catch {
      toast.error("Could not verify your session");
      return false;
    }
  }

  return { user, isPending, ensureReady };
}
