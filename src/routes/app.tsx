import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/layout/app-shell";
import { getMyMemberships, getMyProfile } from "@/lib/community/server";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    Promise.all([getMyProfile(), getMyMemberships()])
      .then(([profile, memberships]) => {
        if (!profile || memberships.length === 0) {
          void navigate({ to: "/onboarding", search: {} });
          return;
        }
        setReady(true);
      })
      .catch(() => {
        void navigate({ to: "/onboarding", search: {} });
      });
  }, [user, isPending, navigate]);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-32 animate-pulse rounded-full bg-bg-subtle" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-32 animate-pulse rounded-full bg-bg-subtle" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
