import { EVENT_KINDS } from "@/lib/community/types";

export type DateWindow = "week" | "today" | "upcoming" | "all" | string;

export function eventDateKey(iso: string, tz = "America/New_York"): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(t));
}

export function matchesDateWindow(iso: string, window: DateWindow, now = Date.now()): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (window === "all") return true;
  const today = eventDateKey(new Date(now).toISOString());
  const key = eventDateKey(iso);
  if (window === "today") return key === today;
  if (window === "week") {
    const end = now + 7 * 24 * 3600 * 1000;
    return t >= now - 6 * 3600 * 1000 && t <= end;
  }
  if (window === "upcoming") return t >= now - 6 * 3600 * 1000;
  if (/^\d{4}-\d{2}-\d{2}$/.test(window)) return key === window;
  return true;
}

export function ActivityFilters({
  dateWindow,
  onDateWindow,
  kind,
  onKind,
  kinds,
}: {
  dateWindow: DateWindow;
  onDateWindow: (w: DateWindow) => void;
  kind: string;
  onKind: (k: string) => void;
  kinds?: { id: string; label: string }[];
}) {
  const options = kinds ?? [{ id: "all", label: "All kinds" }, ...EVENT_KINDS];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["week", "This week"],
            ["today", "Today"],
            ["upcoming", "Upcoming"],
            ["all", "All dates"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onDateWindow(id)}
            className={
              dateWindow === id
                ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
            }
          >
            {label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="sr-only">Pick a date</span>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(dateWindow) ? dateWindow : ""}
            onChange={(e) => onDateWindow(e.target.value || "week")}
            className="rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onKind(k.id)}
            className={
              kind === k.id
                ? "rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-sm text-primary"
                : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
            }
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
