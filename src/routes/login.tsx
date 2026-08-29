import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginSearch = { redirect?: string; forgot?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    forgot: typeof s.forgot === "string" ? s.forgot : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, forgot } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">(forgot === "1" ? "forgot" : "signin");
  const [resetNote, setResetNote] = useState<string | null>(null);

  async function onEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (res.error) {
        setError(res.error.message ?? "Could not sign in");
        return;
      }
      await navigate({ to: (redirect || "/app") as "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter the email you used to create this Neighborly account.");
      return;
    }
    setBusy(true);
    setError(null);
    setResetNote(null);
    try {
      const client = authClient as typeof authClient & {
        requestPasswordReset?: (args: {
          email: string;
          redirectTo: string;
        }) => Promise<{ error?: { message?: string } | null }>;
        forgetPassword?: (args: {
          email: string;
          redirectTo: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
      const requestReset = client.requestPasswordReset ?? client.forgetPassword;
      if (!requestReset) {
        setError("Password reset is not available in this build. Write lincoln@unitedundergod.org.");
        return;
      }
      const res = await requestReset({
        email: trimmed,
        redirectTo: "/reset-password",
      });
      if (res.error) {
        setError(
          res.error.message ??
            "Could not start a password reset. Write lincoln@unitedundergod.org.",
        );
        return;
      }
      setResetNote(
        "If an account exists for that email, we queued a reset. Check your inbox and spam. Neighborly uses its own login — this does not reset Kindred, Kids Need Dads, or Presence. If nothing arrives, write lincoln@unitedundergod.org and we will finish the reset from the ops desk.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start a password reset. Write lincoln@unitedundergod.org.",
      );
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
          <CardTitle>{mode === "forgot" ? "Reset your password" : "Welcome back"}</CardTitle>
          <CardDescription>
            {mode === "forgot"
              ? "Neighborly keeps its own email/password login. Google/X sign-in does not need a password."
              : "Sign in to your communities, needs, and invites."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {authEnabled ? (
            <>
              {mode === "signin" && (
                <>
              <div className="grid gap-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: redirect || "/app" })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>

              <div className="relative py-1 text-center text-xs text-fg-subtle">
                <span className="bg-bg-elevated px-2 relative z-10">or email</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>
                </>
              )}

              {mode === "signin" ? (
              <form onSubmit={onEmailSignIn} className="space-y-3">
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
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setResetNote(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in with email"}
                </Button>
              </form>
              ) : (
              <form onSubmit={onForgot} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}
                {resetNote && (
                  <p className="rounded-[var(--radius-sm)] bg-primary-soft px-3 py-2 text-sm text-primary">
                    {resetNote}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setResetNote(null);
                  }}
                >
                  Back to sign in
                </button>
              </form>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-muted">Sign-in is disabled in this environment.</p>
          )}

          <p className="text-center text-sm text-fg-muted">
            New here?{" "}
            <Link
              to="/signup"
              search={{}}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create a free account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
