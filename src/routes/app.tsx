import { Navigate, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/layout/app-shell";
import { getMyMemberships, getMyProfile } from "@/lib/community/server";
import { OFFER_SERVICE_PATH } from "@/lib/community/offer-path";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const next =
    location.pathname === OFFER_SERVICE_PATH || location.pathname.startsWith(`${OFFER_SERVICE_PATH}/`)
      ? OFFER_SERVICE_PATH
      : undefined;

  useEffect(() => {
    if (isPending || !user) return;
    Promise.all([getMyProfile(), getMyMemberships()])
      .then(([profile, memberships]) => {
        if (!profile || memberships.length === 0) {
          void navigate({ to: "/onboarding", search: { next } });
          return;
        }
        setReady(true);
      })
      .catch(() => {
        void navigate({ to: "/onboarding", search: { next } });
      });
  }, [user, isPending, navigate, next]);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-32 animate-pulse rounded-full bg-bg-subtle" />
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: next || location.pathname || "/app" }}
      />
    );
  }
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
