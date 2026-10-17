import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HandHeart, Menu, X } from "lucide-react";
import { SignedIn } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; match: (path: string, search: string) => boolean; search?: Record<string, string>; params?: Record<string, string> };

const NAV: NavItem[] = [
  { label: "This weekend", to: "/weekend", match: (p) => p.startsWith("/weekend") },
  { label: "Vidalia board", to: "/c/$slug", params: { slug: "vidalia" }, match: (p) => p === "/c/vidalia" },
  { label: "Search", to: "/search", match: (p) => p.startsWith("/search") },
  { label: "Churches", to: "/churches", search: { zip: "30474" }, match: (p) => p.startsWith("/churches") },
  { label: "Ministry", to: "/ministry", search: { place: "vidalia" }, match: (p) => p.startsWith("/ministry") },
  { label: "Communities", to: "/communities", match: (p) => p.startsWith("/communities") },
  { label: "How it works", to: "/how-it-works", match: (p) => p.startsWith("/how-it-works") },
];

function NavLink({ item, path, search, className, onClick }: { item: NavItem; path: string; search: string; className?: string; onClick?: () => void }) {
  const current = item.match(path, search);
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={item.to as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params={item.params as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search={item.search as any}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-base no-underline transition-colors",
        current ? "bg-bg-subtle font-medium text-fg" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}

/**
 * Compact signed-in chip for the header: initial and a 44px Sign out (the
 * name lives in My hub). Keeps the bar on one line at every width.
 */
function HeaderUserChip({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <div className="hidden shrink-0 items-center gap-1 sm:flex">
      <span
        aria-hidden
        title={first}
        className="grid h-8 w-8 place-items-center rounded-full bg-bg-subtle text-sm font-semibold text-fg"
      >
        {first.charAt(0).toUpperCase()}
      </span>
      {authEnabled && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm text-fg-muted hover:text-fg"
        >
          Sign out
        </button>
      )}
    </div>
  );
}

/** Shared site header: logo, main nav (≥1180px), Sign in, and a ☰ menu under 1180px. */
export function SiteHeader({ solid: _solid = true }: { solid?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const loc = useRouterState({ select: (s) => s.location });
  const path = loc.pathname;
  const search = loc.searchStr ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path, search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="page-shell flex min-h-16 flex-nowrap items-center gap-2">
        <Link to="/" className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-fg no-underline" aria-label="Neighborly home">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-primary-fg">
            <HandHeart className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Neighborly</span>
        </Link>

        <nav aria-label="Main" className="ml-2 hidden shrink-0 items-center gap-0.5 min-[1180px]:flex">
          {NAV.map((item) => (
            <NavLink key={item.label} item={item} path={path} search={search} />
          ))}
        </nav>

        <span className="min-w-0 flex-1" />

        {isPending ? (
          <div className="h-11 w-24 animate-pulse rounded-full bg-bg-subtle" />
        ) : user ? (
          <SignedIn>
            <HeaderUserChip name={user.displayName ?? user.primaryEmail ?? "Account"} />
            <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
              <Link to="/app">My hub</Link>
            </Button>
          </SignedIn>
        ) : (
          <Link
            to="/login"
            search={{ redirect: "/app" }}
            className="inline-flex min-h-11 items-center px-3 text-base font-semibold text-fg no-underline hover:text-primary"
          >
            Sign in
          </Link>
        )}

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg-elevated text-fg min-[1180px]:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-16 z-30 cursor-default bg-fg/20 min-[1180px]:hidden"
            onClick={() => setOpen(false)}
          />
          <nav
            id="site-menu"
            aria-label="Menu"
            className="absolute inset-x-0 top-full z-40 border-b border-border bg-bg-elevated shadow-lg min-[1180px]:hidden"
          >
            <div className="page-shell flex flex-col py-3">
              {NAV.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  path={path}
                  search={search}
                  className="w-full rounded-[var(--radius-md)] px-4 text-lg"
                  onClick={() => setOpen(false)}
                />
              ))}
              {user && authEnabled && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex min-h-11 w-full items-center rounded-[var(--radius-md)] px-4 text-left text-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
                >
                  Sign out
                </button>
              )}
              {!user && (
                <Link
                  to="/signup"
                  search={{ community: "vidalia", code: "VIDALIA-WELCOME" }}
                  className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-fg no-underline"
                >
                  Create a free account
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
