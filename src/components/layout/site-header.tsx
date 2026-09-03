import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { HandHeart } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

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

        <nav className="flex items-center gap-4 text-sm text-fg-muted sm:gap-6">
          <Link to="/weekend" search={{ place: "vidalia" }} className="font-medium text-fg hover:text-primary">
            This weekend
          </Link>
          <Link to="/near" className="hidden hover:text-fg sm:inline">
            Find a town
          </Link>
          <Link to="/c/$slug" params={{ slug: "vidalia" }} className="hidden hover:text-fg sm:inline">
            Vidalia board
          </Link>
          <Link to="/communities" className="hidden hover:text-fg md:inline">
            Communities
          </Link>
          <Link to="/how-it-works" className="hidden hover:text-fg md:inline">
            How it works
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
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/admin">Ops</Link>
              </Button>
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
                    await navigate({
                      to: "/signup",
                      search: { community: "vidalia", code: "VIDALIA-WELCOME" },
                    });
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
