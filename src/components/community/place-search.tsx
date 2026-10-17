import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeSavedPlace, type SavedPlace } from "@/lib/community/saved-place";
import { saveHomePlace } from "@/lib/community/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type NearResponse = {
  ok?: boolean;
  found?: boolean;
  created?: boolean;
  wouldCreate?: boolean;
  error?: string;
  community?: { slug: string; name: string; city: string; state: string; zip?: string };
  geo?: { zip: string; city: string; state: string; lat: number; lon: number } | null;
  weekendPath?: string | null;
  boardPath?: string | null;
};

function toSaved(d: NearResponse): SavedPlace | null {
  const city = d.community?.city || d.geo?.city || "";
  const state = d.community?.state || d.geo?.state || "";
  const zip = d.community?.zip || d.geo?.zip || "";
  if (!city && !zip) return null;
  return {
    zip,
    city,
    state,
    label: [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : ""),
    lat: d.geo?.lat ?? null,
    lon: d.geo?.lon ?? null,
    slug: d.community?.slug,
  };
}

export function PlaceSearch({
  defaultValue = "",
  size = "md",
  persist = true,
  onSearchStart,
  onSearchEnd,
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  persist?: boolean;
  /** Fired the moment a new search begins, so the page can clear old results. */
  onSearchStart?: (query: string) => void;
  /** Fired when the lookup (and any navigation) is done or failed. */
  onSearchEnd?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [q, setQ] = useState(defaultValue);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<NearResponse | null>(null);

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  async function persistPlace(d: NearResponse) {
    if (!persist) return;
    const saved = toSaved(d);
    if (!saved) return;
    writeSavedPlace(saved);
    if (user) {
      try {
        await saveHomePlace({
          data: {
            home_zip: saved.zip,
            home_city: saved.city,
            home_state: saved.state,
            home_lat: saved.lat ?? null,
            home_lon: saved.lon ?? null,
          },
        });
      } catch {
        /* guest storage is enough */
      }
    }
  }

  async function go(d: NearResponse) {
    await persistPlace(d);
    if (d.community?.slug) {
      await navigate({ to: "/weekend", search: { place: d.community.slug } });
      return;
    }
    const label = d.geo ? d.geo.zip || `${d.geo.city}, ${d.geo.state}` : q;
    await navigate({ to: "/weekend", search: { q: label } });
  }

  async function lookup(query: string, extra: { lat?: number; lon?: number; create?: boolean } = {}) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (extra.lat != null) params.set("lat", String(extra.lat));
    if (extra.lon != null) params.set("lon", String(extra.lon));
    if (extra.create) params.set("create", "1");
    const res = await fetch(`/api/near?${params.toString()}`);
    const d = (await res.json()) as NearResponse;
    if (!res.ok && !d.wouldCreate) {
      throw new Error(d.error || "Could not find that place.");
    }
    return d;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      setError("Type a 5-digit ZIP or City, ST.");
      return;
    }
    setBusy(true);
    setError("");
    setPendingCreate(null);
    onSearchStart?.(query);
    try {
      const d = await lookup(query);
      if (d.community?.slug) {
        await go(d);
        return;
      }
      if (d.geo) {
        // No board yet: still show what's on nearby this weekend.
        await go(d);
        return;
      }
      setError(d.error || "We couldn't find that place. Try a 5-digit ZIP.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look that up. Try again.");
    } finally {
      setBusy(false);
      onSearchEnd?.();
    }
  }

  async function useBrowserLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share a location. Type a ZIP instead.");
      return;
    }
    setBusy(true);
    setError("");
    setPendingCreate(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        onSearchStart?.("");
        try {
          const d = await lookup("", { lat: pos.coords.latitude, lon: pos.coords.longitude });
          if (d.community?.slug) {
            toast.success(`Using ${d.community.city}, ${d.community.state}`);
            await go(d);
            return;
          }
          if (d.geo) {
            setQ(`${d.geo.city}, ${d.geo.state}`);
            await go(d);
            return;
          }
          setError(d.error || "Could not turn that location into a town.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Location lookup failed.");
        } finally {
          setBusy(false);
          onSearchEnd?.();
        }
      },
      () => {
        setBusy(false);
        setError("Location is turned off. Type a ZIP or City, ST instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function confirmCreate() {
    if (!pendingCreate?.geo) return;
    setBusy(true);
    try {
      const query = `${pendingCreate.geo.city}, ${pendingCreate.geo.state}`;
      const d = await lookup(query, { create: true });
      if (!d.community?.slug) {
        setError(d.error || "Could not open that board.");
        return;
      }
      toast.success(`Welcome to ${d.community.name} on Neighborly.`);
      await go(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that board.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-xl space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Your ZIP or town, like 30474"
          aria-label="Town or ZIP"
          inputMode="search"
          autoComplete="postal-code"
          className="h-[52px] min-w-0 rounded-full px-5 text-base sm:flex-1"
        />
        <Button type="submit" disabled={busy} size="lg" className="h-[52px] rounded-full px-6">
          {busy ? "Looking…" : "See what's on"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void useBrowserLocation()}>
          <LocateFixed className="h-4 w-4" />
          Use my location
        </Button>
        <p className="text-base text-fg-muted">Any town or ZIP in Georgia works.</p>
      </div>
      {pendingCreate?.geo && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-4 text-base">
          <p className="text-fg">
            {pendingCreate.geo.city}, {pendingCreate.geo.state}
            {pendingCreate.geo.zip ? ` ${pendingCreate.geo.zip}` : ""} has no Neighborly board yet.
          </p>
          <p className="mt-1 text-fg-muted">
            Start one so neighbors nearby can share what&apos;s on and lend a hand.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void confirmCreate()}>
              Start the {pendingCreate.geo.city} board
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPendingCreate(null)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
