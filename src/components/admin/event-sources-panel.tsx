import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getEventSourceHealth, refreshEventSourcesNow, type SourceHealthRow } from "@/lib/events/health";

function when(iso: string | null): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Owner view of the weekend feed's sources: last good refresh, count, last error. */
export function EventSourcesPanel() {
  const [rows, setRows] = useState<SourceHealthRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getEventSourceHealth()
      .then((r) => setRows(r.status === "ok" ? r.rows : []))
      .catch(() => setRows([]));
  }, []);
  if (rows === null || rows.length === 0) return null;
  const stale = (r: SourceHealthRow) => !r.lastSuccessIso || Date.now() - Date.parse(r.lastSuccessIso) > 36 * 3600 * 1000;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Weekend feed sources</h2>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await refreshEventSourcesNow();
              if (r.status === "ok") setRows(r.rows);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Refreshing…" : "Refresh now"}
        </Button>
      </div>
      <p className="text-base text-fg-muted">Refreshed daily at 5:15 AM Eastern. A failing source keeps its last good events.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-base">
          <thead className="text-fg-muted">
            <tr>
              <th className="py-2 pr-4 font-semibold">Source</th>
              <th className="py-2 pr-4 font-semibold">Last good refresh</th>
              <th className="py-2 pr-4 font-semibold">Events</th>
              <th className="py-2 font-semibold">Last error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 pr-4">
                  <a className="tap underline" href={r.url} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                </td>
                <td className={stale(r) ? "py-2 pr-4 font-semibold text-danger" : "py-2 pr-4"}>{when(r.lastSuccessIso)}</td>
                <td className="py-2 pr-4">{r.count}</td>
                <td className="py-2 text-fg-muted">{r.lastError || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
