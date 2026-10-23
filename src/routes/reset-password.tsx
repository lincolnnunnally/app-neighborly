import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  // Signed-in / account pages stay out of search.
  head: () => ({ meta: [{ title: "Reset password — Neighborly" }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): ResetSearch => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const invalidLink = useMemo(
    () => !token || error === "INVALID_TOKEN",
    [token, error],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setFormError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Those passwords did not match.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const client = authClient as typeof authClient & {
        resetPassword?: (args: {
          newPassword: string;
          token: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
      if (!client.resetPassword) {
        setFormError(`Password reset isn't working right now. Email ${SUPPORT_EMAIL} and we'll help you get back in.`);
        return;
      }
      const res = await client.resetPassword({
        newPassword: password,
        token,
      });
      if (res.error) {
        setFormError(res.error.message ?? "Could not reset that password. Request a new link.");
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        void navigate({ to: "/login", search: { redirect: "/app" } });
      }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not reset that password.");
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
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Set a new password</h1>
          <CardDescription>
            Choose a new password for your Neighborly account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!authEnabled ? (
            <p className="text-sm text-fg-muted">Sign-in is disabled in this environment.</p>
          ) : invalidLink ? (
            <>
              <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                This link has expired. We'll send you a fresh one.
              </p>
              <Button asChild className="w-full">
                <Link to="/login" search={{ redirect: "/app", forgot: "1" }}>
                  Request a new link
                </Link>
              </Button>
            </>
          ) : done ? (
            <p className="text-sm text-fg-muted">Password updated. Taking you to sign in…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {formError && (
                <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
    </div>
  );
}
