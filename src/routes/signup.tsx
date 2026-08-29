import { useEffect, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveInvite } from "@/lib/community/server";
import type { Community } from "@/lib/community/types";

type SignupSearch = { community?: string; code?: string };

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): SignupSearch => ({
    community: typeof s.community === "string" ? s.community : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
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
      void navigate({
        to: "/onboarding",
        search: {
          community: search.community,
          code: search.code,
        },
      });
    }
  }, [user, isPending, navigate, search.community, search.code]);

  const onboardingQs = new URLSearchParams();
  if (search.community) onboardingQs.set("community", search.community);
  if (search.code) onboardingQs.set("code", search.code);
  const callbackURL = `/onboarding${onboardingQs.toString() ? `?${onboardingQs}` : ""}`;

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
      await navigate({
        to: "/onboarding",
        search: { community: search.community, code: search.code },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link to="/" className="mb-2 flex items-center gap-2 text-fg no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-fg">
              <HandHeart className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold">Neighborly</span>
          </Link>
          <CardTitle>Create your neighbor profile</CardTitle>
          <CardDescription>
            Step 1 of 3 — account. Then you'll set skills and pick communities.
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
                  . These pages are working product copy pending attorney review.
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
              search={{ redirect: "/app" }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
