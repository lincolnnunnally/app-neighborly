import { useEffect, useState } from "react";
import {
  getPresenceConnectStatus,
  PRESENCE_CONNECT_URL,
  type PresenceConnectStatus,
} from "@/lib/community/presence-connect";

/**
 * Presence door: Connect status + entry into Presence Connect.
 * The feature lives in Presence; this is only the doorway (no parallel version).
 */
export function PresenceConnectCard() {
  const [status, setStatus] = useState<PresenceConnectStatus | null>(null);

  useEffect(() => {
    let alive = true;
    getPresenceConnectStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus({ state: null, openPlans: 0 }));
    return () => {
      alive = false;
    };
  }, []);

  const line =
    status?.state === "on"
      ? `Connect is On in Presence${status.openPlans ? ` · ${status.openPlans} open plan${status.openPlans > 1 ? "s" : ""}` : ""}.`
      : status?.state === "expired"
        ? "Your Connect week ended. Still open to one real coffee?"
        : status?.state === "off"
          ? "Connect is Off. Turn it on when you're open to one real 1:1 this week."
          : "Open to one real coffee, bar, or meal with a neighbor this week?";

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
      <p className="text-sm font-medium text-fg">Presence Connect</p>
      <p className="mt-1 text-xs text-fg-muted">{line}</p>
      <a
        href={PRESENCE_CONNECT_URL}
        className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        {status?.state === "on" ? "Open Connect" : "Go to Presence Connect"} →
      </a>
      <p className="mt-1 text-[11px] text-fg-subtle">
        First names and shared interests only. Never your location. Meet in public.
      </p>
    </div>
  );
}
