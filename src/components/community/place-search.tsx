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
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  persist?: boolean;
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
    const label = d.geo ? `${d.geo.city}, ${d.geo.state}` : q;
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
    try {
      const d = await lookup(query);
      if (d.community?.slug) {
        await go(d);
        return;
      }
      if (d.wouldCreate && d.geo) {
        setPendingCreate(d);
        return;
      }
      setError(d.error || "Could not find that place.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look that up. Try again.");
    } finally {
      setBusy(false);
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
        try {
          const d = await lookup("", { lat: pos.coords.latitude, lon: pos.coords.longitude });
          if (d.community?.slug) {
            toast.success(`Using ${d.community.city}, ${d.community.state}`);
            await go(d);
            return;
          }
          if (d.geo) {
            setQ(`${d.geo.city}, ${d.geo.state}`);
            setPendingCreate(d);
            return;
          }
          setError(d.error || "Could not turn that location into a town.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Location lookup failed.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError("Location was blocked. Type a ZIP or City, ST instead — we will not guess.");
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
      toast.message(`Opened an empty board for ${d.community.name}. We did not invent events.`);
      await go(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that board.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-xl space-y-2">
      <div className={size === "lg" ? "flex flex-col gap-2 sm:flex-row" : "flex gap-2"}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ZIP or City, ST — e.g. 30474 or Vidalia, GA"
          aria-label="City or ZIP"
          className={size === "lg" ? "h-12 text-base" : ""}
        />
        <Button type="submit" disabled={busy} size={size === "lg" ? "lg" : "default"}>
          {busy ? "Looking…" : "What's going on"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void useBrowserLocation()}>
          <LocateFixed className="h-4 w-4" />
          Use my location
        </Button>
        <p className="text-xs text-fg-subtle">
          Location is optional. A probe never opens an empty town — you confirm first.
        </p>
      </div>
      {pendingCreate?.geo && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3 text-sm">
          <p className="text-fg">
            {pendingCreate.geo.city}, {pendingCreate.geo.state}
            {pendingCreate.geo.zip ? ` ${pendingCreate.geo.zip}` : ""} has no Neighborly board yet.
          </p>
          <p className="mt-1 text-fg-muted">
            We can save an honest empty board so the next neighbor is not starting from zero. We
            will not invent events.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void confirmCreate()}>
              Open empty board
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPendingCreate(null)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
