import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { resolveInvite } from "@/lib/community/server";
import type { Community } from "@/lib/community/types";
import { isEventNext, readNext } from "@/lib/safe-next";

type SignupSearch = { community?: string; code?: string; next?: string };

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): SignupSearch => ({
    community: typeof s.community === "string" ? s.community : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
    next: readNext(s.next),
  }),
  component: SignupPage,
});

function SignupPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteCommunity, setInviteCommunity] = useState<Community | null>(null);

  useEffect(() => {
    if (search.code) {
      resolveInvite({ data: search.code })
        .then((r) => setInviteCommunity(r?.community ?? null))
        .catch(() => setInviteCommunity(null));
    }
  }, [search.code]);

  useEffect(() => {
    if (!isPending && user) {
      // Came from an event's "I'll be there": go straight back so the RSVP
      // finishes. The rest of the profile can wait.
      if (isEventNext(search.next)) {
        void navigate({ href: search.next });
        return;
      }
      void navigate({
        to: "/onboarding",
        search: {
          community: search.community,
          code: search.code,
          next: search.next,
        },
      });
    }
  }, [user, isPending, navigate, search.community, search.code, search.next]);

  const onboardingQs = new URLSearchParams();
  if (search.community) onboardingQs.set("community", search.community);
  if (search.code) onboardingQs.set("code", search.code);
  if (search.next) onboardingQs.set("next", search.next);
  const callbackURL = isEventNext(search.next)
    ? search.next
    : `/onboarding${onboardingQs.toString() ? `?${onboardingQs}` : ""}`;

  async function onEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim() || email.split("@")[0] || "Neighbor",
      });
      if (res.error) {
        setError(res.error.message ?? "Could not create account");
        return;
      }
      if (isEventNext(search.next)) {
        await navigate({ href: search.next });
        return;
      }
      await navigate({
        to: "/onboarding",
        search: { community: search.community, code: search.code, next: search.next },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="grid place-items-center px-5 py-10 sm:py-16">
      <Card className="w-full max-w-[440px]">
        <CardHeader>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Create your neighbor profile</h1>
          <CardDescription>
            {search.community === "vidalia" || search.code === "VIDALIA-WELCOME" || !search.community
              ? "Join Vidalia, then pick your skills and the groups you care about."
              : "Step 1 of 3 — account. Then you'll set skills and pick communities."}
          </CardDescription>
          {inviteCommunity && (
            <p className="rounded-[var(--radius-md)] bg-primary-soft px-3 py-2 text-sm text-primary">
              Invite for <strong>{inviteCommunity.name}</strong> will be applied after
              you finish setup.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {authEnabled ? (
            <>
              <div className="grid gap-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>

              <div className="relative py-1 text-center text-xs text-fg-subtle">
                <span className="relative z-10 bg-bg-elevated px-2">or email</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

              <form onSubmit={onEmailSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How neighbors will see you"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-fg-subtle">At least 8 characters.</p>
                </div>
                <p className="text-xs text-fg-muted">
                  By continuing you agree to Neighborly{" "}
                  <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                    Privacy
                  </Link>
                  .
                </p>
                {error && (
                  <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Continue"}
                </Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-fg-muted">Sign-up is disabled here.</p>
          )}

          <p className="text-center text-sm text-fg-muted">
            Already have an account?{" "}
            <Link
              to="/login"
              search={search.next ? { next: search.next } : {}}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
    </div>
  );
}
