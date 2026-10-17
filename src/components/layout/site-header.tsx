import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HandHeart, Menu, X } from "lucide-react";
import { SignedIn, UserButton } from "@/lib/auth/gates";
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
        "inline-flex min-h-11 items-center rounded-full px-3 text-base no-underline transition-colors",
        current ? "bg-bg-subtle font-medium text-fg" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}

/** Shared site header: logo, main nav (≥960px), Sign in, and a ☰ menu under 960px. */
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
      <div className="page-shell flex min-h-16 items-center gap-2">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2.5 text-fg no-underline" aria-label="Neighborly home">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-primary-fg">
            <HandHeart className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Neighborly</span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 min-[960px]:flex">
          {NAV.map((item) => (
            <NavLink key={item.label} item={item} path={path} search={search} />
          ))}
        </nav>

        <span className="flex-1" />

        {isPending ? (
          <div className="h-11 w-24 animate-pulse rounded-full bg-bg-subtle" />
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
          className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg-elevated text-fg min-[960px]:hidden"
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
            className="fixed inset-0 top-16 z-30 cursor-default bg-fg/20 min-[960px]:hidden"
            onClick={() => setOpen(false)}
          />
          <nav
            id="site-menu"
            aria-label="Menu"
            className="absolute inset-x-0 top-full z-40 border-b border-border bg-bg-elevated shadow-lg min-[960px]:hidden"
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
