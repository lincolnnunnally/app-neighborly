import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/layout/app-shell";
import { getMyMemberships, getMyProfile } from "@/lib/community/server";
import { OFFER_PANTRY_PATH, OFFER_SERVICE_PATH, OFFER_TOOL_PATH } from "@/lib/community/offer-path";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  // Captured once, at mount. Reading location.pathname at <Navigate> time gives
  // "/login" — the redirect has already begun by the time that render runs —
  // which sent every signed-out visitor back to the login page after signing
  // in, instead of to the page they actually asked for.
  const [intendedPath] = useState(() => location.pathname);
  const next =
    location.pathname === OFFER_SERVICE_PATH || location.pathname.startsWith(`${OFFER_SERVICE_PATH}/`)
      ? OFFER_SERVICE_PATH
      : location.pathname === OFFER_TOOL_PATH || location.pathname.startsWith(`${OFFER_TOOL_PATH}/`)
        ? OFFER_TOOL_PATH
        : location.pathname === OFFER_PANTRY_PATH || location.pathname.startsWith(`${OFFER_PANTRY_PATH}/`)
          ? OFFER_PANTRY_PATH
          : undefined;

  const signedOutRedirect =
    next || (intendedPath.startsWith("/login") ? "/app" : intendedPath) || "/app";

  // Redirect imperatively, once. Rendering <Navigate> here kept this still-
  // mounted layout re-issuing the same navigation every render, which React
  // reported as "Maximum update depth exceeded" on every signed-out visit to
  // an /app route.
  useEffect(() => {
    if (isPending || user) return;
    void navigate({ to: "/login", search: { redirect: signedOutRedirect }, replace: true });
  }, [isPending, user, navigate, signedOutRedirect]);

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
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-10 w-32 animate-pulse rounded-full bg-bg-subtle" />
      </div>
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
