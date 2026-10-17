import { useEffect, useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HandHeart, Menu, X } from "lucide-react";
import { SignedIn } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { boardLink, useCurrentPlace, type CurrentPlace } from "@/lib/community/current-place";

type NavItem = { label: string; to: string; match: (path: string, search: string) => boolean; search?: Record<string, string>; params?: Record<string, string> };

/**
 * Main nav for the town being viewed (searched or saved, Vidalia by default).
 * A town with a board links to it; one without gets a neutral "Neighbor board"
 * that opens the existing "start your town" page (/near).
 */
function navFor(place: CurrentPlace): NavItem[] {
  const board = boardLink(place);
  return [
    { label: "This weekend", to: "/weekend", match: (p) => p.startsWith("/weekend") },
    board.slug
      ? { label: board.label, to: "/c/$slug", params: { slug: board.slug }, match: (p) => p === `/c/${board.slug}` }
      : { label: board.label, to: "/near", search: place.zip ? { zip: place.zip } : undefined, match: (p) => p === "/near" },
    { label: "Search", to: "/search", match: (p) => p.startsWith("/search") },
    {
      label: "Churches",
      to: "/churches",
      search: place.zip ? { zip: place.zip } : { q: place.city },
      match: (p) => p.startsWith("/churches"),
    },
    // Ministry lives on a board, so a town without one doesn't get another town's.
    ...(place.board
      ? [{ label: "Ministry", to: "/ministry", search: { place: place.board }, match: (p: string) => p.startsWith("/ministry") }]
      : []),
    { label: "Communities", to: "/communities", match: (p) => p.startsWith("/communities") },
    { label: "How it works", to: "/how-it-works", match: (p) => p.startsWith("/how-it-works") },
  ];
}

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

/**
 * The ☰ menu's open state lives outside the header component. Every page renders
 * its own <SiteHeader>, so a tap made while the next page was still loading used
 * to open a header that was about to be replaced: the new page mounted a fresh,
 * closed header and the tap was lost ("the first tap does nothing"). The menu now
 * stays open across that swap and closes when the visitor goes to another page
 * (a menu link, Escape, the backdrop, or a different path).
 */
type MenuState = { open: boolean; path: string };
const MENU_CLOSED: MenuState = { open: false, path: "" };
let menuState: MenuState = MENU_CLOSED;
const menuListeners = new Set<() => void>();
function setMenu(next: MenuState) {
  menuState = next;
  for (const l of menuListeners) l();
}
function subscribeMenu(l: () => void) {
  menuListeners.add(l);
  return () => {
    menuListeners.delete(l);
  };
}
function useMenuOpen(path: string): [boolean, (open: boolean) => void] {
  const m = useSyncExternalStore(subscribeMenu, () => menuState, () => MENU_CLOSED);
  const open = m.open && m.path === path;
  return [open, (next) => setMenu(next ? { open: true, path } : MENU_CLOSED)];
}

/** Shared site header: logo, main nav (≥1180px), Sign in, and a ☰ menu under 1180px. */
export function SiteHeader({ solid: _solid = true }: { solid?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const loc = useRouterState({ select: (s) => s.location });
  const path = loc.pathname;
  const search = loc.searchStr ?? "";
  const [open, setOpen] = useMenuOpen(path);
  const place = useCurrentPlace();
  const NAV = navFor(place);

  // The page is interactive now: open the menu for a ☰ tap made before it was
  // (noted by the small inline script in __root).
  useEffect(() => {
    const w = window as Window & { __nbMenuReady?: boolean; __nbMenuTap?: boolean };
    w.__nbMenuReady = true;
    if (w.__nbMenuTap) {
      w.__nbMenuTap = false;
      setMenu({ open: true, path: window.location.pathname });
    }
  }, []);

  // Left the page the menu was opened on (back button, a link elsewhere): close it.
  // A query-string tidy-up on the same page (e.g. ?zip= gaining &q=) keeps it open.
  useEffect(() => {
    if (menuState.open && menuState.path !== path) setMenu(MENU_CLOSED);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(MENU_CLOSED);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="page-shell flex min-h-16 flex-nowrap items-center gap-2">
        {/* No hover prefetch: bare / follows the saved-town cookie, so load it on click. */}
        <Link
          to="/"
          preload={false}
          className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-fg no-underline"
          aria-label="Neighborly home"
        >
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
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <>
          {/* The header's backdrop-blur makes it the containing block for `fixed`
              children, so a fixed backdrop collapsed to nothing; hang it below the header. */}
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-x-0 top-full z-30 h-[100dvh] cursor-default bg-fg/20 min-[1180px]:hidden"
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
                  // Vidalia's welcome invite only when the visitor is looking at Vidalia.
                  search={place.isVidalia ? { community: "vidalia", code: "VIDALIA-WELCOME" } : {}}
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
