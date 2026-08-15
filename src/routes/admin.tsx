import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerDashboard, type NeighborlyCounts, type OwnerDashboard } from "@/lib/admin-stats";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ENGINE_APP = "https://appengine.unitedundergod.org/apps/neighborly";
const ENGINE_HELP = "https://appengine.unitedundergod.org/help?app=neighborly";

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return String(value);
}

function CountTile({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-fg">
        {formatCount(value)}
      </p>
      <p className="mt-1 text-xs text-fg-muted">{note}</p>
    </div>
  );
}

function CountGrid({ counts }: { counts: NeighborlyCounts }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CountTile
        label="Neighbors"
        value={counts.neighbors}
        note={
          counts.neighbors === null
            ? "No neighbors / profiles table in this schema"
            : "Counted from neighbor profiles"
        }
      />
      <CountTile
        label="Needs"
        value={counts.needs}
        note={counts.needs === null ? "Needs table is not in this schema" : "Posted asks for help"}
      />
      <CountTile
        label="Events"
        value={counts.events}
        note={counts.events === null ? "Events table is not in this schema" : "Gatherings on the board"}
      />
      <CountTile
        label="Posts"
        value={counts.posts}
        note={
          counts.posts === null
            ? "No posts table yet — this field stays empty until one exists"
            : "Community posts"
        }
      />
    </div>
  );
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [dash, setDash] = useState<OwnerDashboard | null>(null);

  useEffect(() => {
    if (isPending) return;
    let cancelled = false;
    getOwnerDashboard()
      .then((next) => {
        if (!cancelled) setDash(next);
      })
      .catch(() => {
        if (!cancelled) setDash({ status: "signed_out" });
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user?.id]);

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-6 py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Owner door
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">
            Neighborly admin
          </h1>
          <p className="mt-2 text-fg-muted">
            Quiet counts from the live board. Empty means empty — nothing here is
            invented.
          </p>
        </div>

        {isPending || !dash ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />
        ) : dash.status === "signed_out" ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in as the owner</CardTitle>
              <CardDescription>
                This page only shows counts after you sign in with the owner
                account. There are no demo users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/login" search={{ redirect: "/admin" }}>
                  Sign in
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : dash.status === "forbidden" ? (
          <Card>
            <CardHeader>
              <CardTitle>Not the owner door</CardTitle>
              <CardDescription>
                Signed in as {dash.email ?? "this account"}. Only the Neighborly
                owner can see these counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to="/app">Back to my hub</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Live schema counts</CardTitle>
              <CardDescription>
                Signed in as {dash.email}. A dash means that table is not in this
                database. A zero means the table is real and empty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CountGrid counts={dash.counts} />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
          <a href={ENGINE_APP} className="hover:text-fg">
            App Engine dossier
          </a>
          <a href={ENGINE_HELP} className="hover:text-fg">
            Help form
          </a>
          <Link to="/" className="hover:text-fg">
            Back home
          </Link>
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="page-shell flex items-center gap-2 text-sm text-fg-subtle">
          <HandHeart className="h-4 w-4 text-primary" />
          Owner view only — not a neighbor-facing board.
        </div>
      </footer>
    </div>
  );
}
