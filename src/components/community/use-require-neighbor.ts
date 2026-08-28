import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyMemberships, getMyProfile } from "@/lib/community/server";

/**
 * Ensures the visitor can perform neighbor actions. Signed-out people go to
 * real signup — we do not mint throwaway @neighborly.demo accounts.
 */
export function useRequireNeighbor() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  async function ensureReady(opts?: { code?: string }): Promise<boolean> {
    if (isPending) return false;

    if (!user) {
      toast.message("Create an account to continue — we don't invent a neighbor for you.");
      await navigate({
        to: "/signup",
        search: { community: "milstead", code: opts?.code ?? "MILSTEAD-WELCOME" },
      });
      return false;
    }

    try {
      const [profile, memberships] = await Promise.all([
        getMyProfile(),
        getMyMemberships(),
      ]);
      if (!profile || memberships.length === 0) {
        toast.message("Finish joining a community first.");
        await navigate({ to: "/onboarding" });
        return false;
      }
      return true;
    } catch {
      toast.error("Could not verify your session");
      return false;
    }
  }

  return { user, isPending, ensureReady };
}
