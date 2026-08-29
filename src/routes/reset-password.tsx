import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
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
        setFormError("Password reset is not available in this build. Write lincoln@unitedundergod.org.");
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
    <main className="grid min-h-dvh place-items-center bg-bg p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link to="/" className="mb-2 flex items-center gap-2 text-fg no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-fg">
              <HandHeart className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold">Neighborly</span>
          </Link>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            Neighborly keeps its own login. This does not change Kindred, Kids Need Dads, or Presence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!authEnabled ? (
            <p className="text-sm text-fg-muted">Sign-in is disabled in this environment.</p>
          ) : invalidLink ? (
            <>
              <p className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm text-danger">
                This reset link is missing, expired, or already used.
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
  );
}
