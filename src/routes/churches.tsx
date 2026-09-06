import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Church, Clock, ExternalLink, LocateFixed, MapPin, Music } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CC_PUBLIC_ORIGIN, type CcChurch } from "@/lib/community/churches";
import { readSavedPlace, writeSavedPlace } from "@/lib/community/saved-place";
import { saveHomePlace } from "@/lib/community/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type ChurchSearch = {
  zip?: string;
  city?: string;
  state?: string;
  q?: string;
  denomination?: string;
  style?: string;
  today?: string;
  morning?: string;
};

function asSearchString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export const Route = createFileRoute("/churches")({
  validateSearch: (s: Record<string, unknown>): ChurchSearch => ({
    zip: asSearchString(s.zip),
    city: asSearchString(s.city),
    state: asSearchString(s.state),
    q: asSearchString(s.q),
    denomination: asSearchString(s.denomination),
    style: asSearchString(s.style),
    today: asSearchString(s.today),
    morning: asSearchString(s.morning),
  }),
  head: () => ({
    meta: [
      { title: "Churches near you — Neighborly" },
      {
        name: "description",
        content:
          "Find nearby churches from ChurchConnect public records — service times, traditional or contemporary, denomination. Neighborly does not keep a second church list.",
      },
    ],
  }),
  component: ChurchesPage,
});

function ChurchesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/churches" });
  const { user } = useCurrentUserState();
  const [zip, setZip] = useState(search.zip || "30474");
  const [city, setCity] = useState(search.city || "Vidalia");
  const [state, setState] = useState(search.state || "GA");
  const [denomination, setDenomination] = useState(search.denomination || "");
  const [style, setStyle] = useState(search.style || "any");
  const [todayOnly, setTodayOnly] = useState(search.today === "1");
  const [morningOnly, setMorningOnly] = useState(search.morning === "1");
  const [rows, setRows] = useState<CcChurch[]>([]);
  const [note, setNote] = useState("");
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(params: URLSearchParams) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/churches?${params.toString()}`);
      const d = (await res.json()) as {
        ok?: boolean;
        churches?: CcChurch[];
        note?: string;
        today?: string;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setError(d.error || "ChurchConnect did not answer. Try again in a moment.");
        setRows([]);
        return;
      }
      setRows(d.churches ?? []);
      setNote(d.note || "");
      setToday(d.today || "");
    } catch {
      setError("Could not reach ChurchConnect public data.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  function queryParams(extra: { lat?: number; lon?: number } = {}) {
    const params = new URLSearchParams();
    if (zip.trim()) params.set("zip", zip.trim());
    if (city.trim()) params.set("city", city.trim());
    if (state.trim()) params.set("state", state.trim());
    if (denomination.trim()) params.set("denomination", denomination.trim());
    if (style && style !== "any") params.set("worship_style", style);
    if (todayOnly) params.set("today", "1");
    if (morningOnly) params.set("morning", "1");
    if (extra.lat != null) params.set("lat", String(extra.lat));
    if (extra.lon != null) params.set("lon", String(extra.lon));
    return params;
  }

  function churchSearch(next?: {
    zip?: string;
    city?: string;
    state?: string;
    denomination?: string;
    style?: string;
    todayOnly?: boolean;
    morningOnly?: boolean;
  }): ChurchSearch {
    const z = (next?.zip ?? zip).trim();
    const c = (next?.city ?? city).trim();
    const st = (next?.state ?? state).trim();
    const den = (next?.denomination ?? denomination).trim();
    const sty = next?.style ?? style;
    const today = next?.todayOnly ?? todayOnly;
    const morning = next?.morningOnly ?? morningOnly;
    return {
      zip: z || undefined,
      city: c || undefined,
      state: st || undefined,
      denomination: den || undefined,
      style: sty && sty !== "any" ? sty : undefined,
      today: today ? "1" : undefined,
      morning: morning ? "1" : undefined,
    };
  }

  function persistFilters(next?: Parameters<typeof churchSearch>[0]) {
    void navigate({ to: "/churches", search: churchSearch(next), replace: true });
  }

  useEffect(() => {
    let nextZip = search.zip || zip;
    let nextCity = search.city || city;
    let nextState = search.state || state;
    if (!search.zip && !search.city) {
      const saved = readSavedPlace();
      if (saved?.zip) nextZip = saved.zip;
      if (saved?.city) nextCity = saved.city;
      if (saved?.state) nextState = saved.state;
      setZip(nextZip);
      setCity(nextCity);
      setState(nextState);
    }
    if (!search.zip) {
      persistFilters({ zip: nextZip, city: nextCity, state: nextState });
    }
    const params = new URLSearchParams();
    if (nextZip.trim()) params.set("zip", nextZip.trim());
    if (nextCity.trim()) params.set("city", nextCity.trim());
    if (nextState.trim()) params.set("state", nextState.trim());
    if (denomination.trim()) params.set("denomination", denomination.trim());
    if (style && style !== "any") params.set("worship_style", style);
    if (todayOnly) params.set("today", "1");
    if (morningOnly) params.set("morning", "1");
    void load(params);
    // initial only — later searches are explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistFromForm() {
    writeSavedPlace({
      zip: zip.trim(),
      city: city.trim(),
      state: state.trim(),
      label: `${city.trim()}, ${state.trim()} ${zip.trim()}`.trim(),
    });
    if (user) {
      try {
        await saveHomePlace({
          data: { home_zip: zip.trim(), home_city: city.trim(), home_state: state.trim() },
        });
      } catch {
        /* local save is enough */
      }
    }
  }

  const denoms = useMemo(() => {
    const set = new Set<string>();
    for (const c of rows) if (c.denomination) set.add(c.denomination);
    return [...set].sort();
  }, [rows]);

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell space-y-8 py-12">
        <div className="max-w-2xl space-y-3">
          <Badge>ChurchConnect records</Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Churches near you
          </h1>
          <p className="text-lg text-fg-muted">
            This door reads the same public ChurchConnect directory used at{" "}
            <a className="underline" href={`${CC_PUBLIC_ORIGIN}/find-church`} target="_blank" rel="noreferrer">
              find-church
            </a>
            . Same IDs. Neighborly does not copy churches into a second database.
            Service times, worship style, and denomination show when ChurchConnect
            has published them.
          </p>
        </div>

        <form
          className="surface-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            persistFilters();
            void persistFromForm();
            void load(queryParams());
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-fg-muted">ZIP</span>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" placeholder="30474" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-fg-muted">City</span>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Vidalia" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-fg-muted">State</span>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="GA" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["any", "Any style"],
                ["traditional", "Traditional"],
                ["contemporary", "Contemporary"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                className={
                  style === id
                    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                    : "rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-fg-muted"
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTodayOnly((v) => !v)}
              className={
                todayOnly
                  ? "rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-sm text-primary"
                  : "rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-fg-muted"
              }
            >
              Today&apos;s services{today ? ` (${today})` : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setMorningOnly((v) => !v);
                if (!morningOnly) setTodayOnly(true);
              }}
              className={
                morningOnly
                  ? "rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-sm text-primary"
                  : "rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-fg-muted"
              }
            >
              This morning
            </button>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-fg-muted">Denomination (refine)</span>
            <Input
              value={denomination}
              onChange={(e) => setDenomination(e.target.value)}
              placeholder="Baptist, Methodist…"
              list="cc-denoms"
            />
            <datalist id="cc-denoms">
              {denoms.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Searching…" : "Find churches"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!navigator.geolocation) {
                  setError("This browser cannot share a location. Use a ZIP.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    void load(queryParams({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
                  },
                  () => setError("Location was blocked. Type a ZIP instead."),
                );
              }}
            >
              <LocateFixed className="h-4 w-4" />
              Use my location
            </Button>
            <Button asChild variant="ghost">
              <Link to="/near">Save a home ZIP</Link>
            </Button>
          </div>
        </form>

        {error && <p className="text-sm text-danger">{error}</p>}
        {note && <p className="text-sm text-fg-muted">{note}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => (
            <article key={c.id} className="surface-card space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                {c.worship_style ? <Badge variant="accent">{c.worship_style}</Badge> : <Badge variant="outline">Style not listed yet</Badge>}
                {c.denomination ? <Badge variant="secondary">{c.denomination}</Badge> : <Badge variant="outline">Denomination not listed yet</Badge>}
                {c.miles != null && <Badge variant="sky">{c.miles} mi</Badge>}
              </div>
              <h2 className="font-display text-xl font-semibold">{c.name}</h2>
              <p className="flex items-start gap-2 text-sm text-fg-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {[c.street_address || c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", ")}
              </p>
              <p className="flex items-start gap-2 text-sm text-fg">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                {c.service_times
                  ? c.todayServices.length
                    ? c.todayServices.map((s) => s.raw).join(" · ")
                    : c.service_times
                  : "Service times will appear when ChurchConnect publishes them."}
              </p>
              {c.pastor_name && (
                <p className="flex items-center gap-2 text-sm text-fg-muted">
                  <Church className="h-4 w-4" />
                  {c.pastor_name}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={c.profileUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    ChurchConnect profile
                  </a>
                </Button>
                {c.website && (
                  <Button asChild size="sm" variant="outline">
                    <a href={c.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!busy && rows.length === 0 && !error && (
          <p className="text-sm text-fg-muted">No public churches matched. We will not invent a congregation.</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Why some filters look empty
            </CardTitle>
            <CardDescription>
              ChurchConnect is finishing service_times, denomination, and worship_style
              on a separate PR. This page already consumes those fields when they are present.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Until those values ship, Vidalia still lists the public directory rows by ZIP and
            city. Confirm anything before you go.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
