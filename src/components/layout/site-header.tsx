import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { toast } from "sonner";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { startDemoNeighbor } from "@/lib/community/try-demo";

export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <header
      className={
        solid
          ? "sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur"
          : "absolute inset-x-0 top-0 z-40"
      }
    >
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 text-fg no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-primary text-primary-fg">
            <HandHeart className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Neighborly
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-fg-muted md:flex">
          <Link to="/communities" className="hover:text-fg">
            Communities
          </Link>
          <Link to="/how-it-works" className="hover:text-fg">
            How it works
          </Link>
          <Link to="/c/$slug" params={{ slug: "milstead" }} className="hover:text-fg">
            Milstead board
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-bg-subtle" />
          ) : user ? (
            <SignedIn>
              <div className="hidden sm:block">
                <UserButton />
              </div>
              <Button asChild size="sm">
                <Link to="/app">My hub</Link>
              </Button>
            </SignedIn>
          ) : (
            <SignedOut>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login" search={{ redirect: "/app" }}>
                  Sign in
                </Link>
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await startDemoNeighbor({ code: "MILSTEAD-WELCOME" });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Welcome to Neighborly");
                    await navigate({ to: "/app" });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "…" : "Try now"}
              </Button>
            </SignedOut>
          )}
        </div>
      </div>
    </header>
  );
}
