import { createServerFn } from "@tanstack/react-start";

export type SourceHealthRow = {
  id: string;
  name: string;
  url: string;
  lastSuccessIso: string | null;
  lastAttemptIso: string | null;
  lastError: string | null;
  count: number;
};

export type SourceHealth = { status: "signed_out" } | { status: "forbidden" } | { status: "ok"; rows: SourceHealthRow[] };

async function ownerGate(): Promise<"signed_out" | "forbidden" | "ok"> {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const { isOwnerEmail } = await import("@/lib/admin-stats");
  const user = await getSessionUser();
  if (!user) return "signed_out";
  return isOwnerEmail(user.email) ? "ok" : "forbidden";
}

async function rows(): Promise<SourceHealthRow[]> {
  const { SOURCES } = await import("./sources");
  const { readSourceStates } = await import("./store");
  const states = await readSourceStates();
  return SOURCES.map((d) => {
    const st = states.get(d.id);
    return {
      id: d.id,
      name: d.name,
      url: d.url,
      lastSuccessIso: st?.lastSuccessMs ? new Date(st.lastSuccessMs).toISOString() : null,
      lastAttemptIso: st?.lastAttemptMs ? new Date(st.lastAttemptMs).toISOString() : null,
      lastError: st?.lastError ?? null,
      count: st?.lastCount ?? 0,
    };
  });
}

/** Owner-only: when each weekend-feed source last refreshed, and why one failed. */
export const getEventSourceHealth = createServerFn({ method: "GET" }).handler(async (): Promise<SourceHealth> => {
  const gate = await ownerGate();
  if (gate !== "ok") return { status: gate };
  return { status: "ok", rows: await rows() };
});

/** Owner-only: run the daily refresh now. */
export const refreshEventSourcesNow = createServerFn({ method: "POST" }).handler(async (): Promise<SourceHealth> => {
  const gate = await ownerGate();
  if (gate !== "ok") return { status: gate };
  const { refreshAllSources } = await import("./sources");
  await refreshAllSources();
  return { status: "ok", rows: await rows() };
});
