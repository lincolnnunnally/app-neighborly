import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  CalendarDays,
  HandHeart,
  Home,
  MapPin,
  QrCode,
  Users,
  Wrench,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";

const nav: {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}[] = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/needs", label: "Needs", icon: HandHeart },
  { to: "/app/services", label: "Services", icon: Wrench },
  { to: "/app/events", label: "Events", icon: CalendarDays },
  { to: "/app/places", label: "Places", icon: Building2 },
  { to: "/app/neighbors", label: "People", icon: Users },
  { to: "/app/communities", label: "Communities", icon: MapPin },
  { to: "/app/invite", label: "Invite", icon: QrCode },
  { to: "/app/settings", label: "Alerts", icon: Bell },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur">
        <div className="page-shell flex h-14 items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2 text-fg no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-fg">
              <HandHeart className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold">Neighborly</span>
          </Link>
          <UserButton />
        </div>
      </header>

      <div className="page-shell flex gap-6 py-4 pb-24 md:pb-8">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-elevated/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {nav.slice(0, 5).map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-fg-subtle",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
