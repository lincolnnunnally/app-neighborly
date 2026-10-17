import { useEffect, useId, useRef } from "react";
import { coordsForPantry, isClosedListing, pantryMapsDirUrl, pantryServeLine } from "@/lib/community/pantry";
import type { Facility } from "@/lib/community/types";

type LeafletMap = {
  remove: () => void;
  fitBounds: (b: unknown, o?: unknown) => void;
  setView: (c: [number, number], z: number) => void;
};

type LeafletMarker = {
  addTo: (m: unknown) => LeafletMarker;
  bindPopup: (html: string) => LeafletMarker;
};

type LeafletNS = {
  map: (el: HTMLElement) => LeafletMap & {
    addLayer: (l: unknown) => void;
    attributionControl?: { setPrefix: (p: string | false) => void };
  };
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: unknown) => void };
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (pts: [number, number][]) => unknown;
};

declare global {
  interface Window {
    L?: LeafletNS;
  }
}

let leafletLoading: Promise<LeafletNS> | null = null;

function loadLeaflet(): Promise<LeafletNS> {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-cdn-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-cdn-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet missing")));
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

function text(value: string) {
  const amp = String.fromCharCode(38);
  return value.split("").map((ch) => {
    if (ch === "<") return amp + "lt;";
    if (ch === ">") return amp + "gt;";
    if (ch === "&") return amp + "amp;";
    if (ch === '"') return amp + "quot;";
    return ch;
  }).join("");
}

export function PantryMap({ pantries }: { pantries: Facility[] }) {
  const id = useId().replace(/:/g, "");
  const mapRef = useRef<LeafletMap | null>(null);
  const pins = pantries
    .map((p) => ({ p, c: coordsForPantry(p.id) }))
    .filter((row): row is { p: Facility; c: { lat: number; lon: number } } => Boolean(row.c));

  useEffect(() => {
    let cancelled = false;
    const el = document.getElementById(`n-pantry-map-${id}`);
    if (!el || !pins.length) return;
    loadLeaflet()
      .then((L) => {
        if (cancelled) return;
        mapRef.current?.remove();
        const map = L.map(el);
        mapRef.current = map;
        // Keep the required map-data credit, as plain text (no tiny link to tap).
        map.attributionControl?.setPrefix(false);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
        // 44x44 tap target around a 26x38 pin, anchored at the pin's tip.
        const pinIcon = L.divIcon({
          className: "n-pantry-pin",
          html:
            '<svg width="26" height="38" viewBox="0 0 26 38" aria-hidden="true"><path d="M13 1C6.4 1 1 6.3 1 12.9 1 22 13 37 13 37s12-15 12-24.1C25 6.3 19.6 1 13 1z" fill="#2f5d50" stroke="#fff" stroke-width="2"/><circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>',
          iconSize: [44, 44],
          iconAnchor: [22, 41],
          popupAnchor: [0, -38],
        });
        const pts: [number, number][] = [];
        for (const { p, c } of pins) {
          pts.push([c.lat, c.lon]);
          const drive = pantryMapsDirUrl({ ...p, lat: c.lat, lon: c.lon });
          const hours = pantryServeLine(p);
          const closed = isClosedListing(p) ? "<br/>Closed or moved" : "";
          const body =
            "<strong>" +
            text(p.name) +
            "</strong><br/>" +
            text(p.address) +
            "<br/>" +
            text(hours) +
            closed +
            (drive ? '<br/><a href="' + drive + '" target="_blank" rel="noreferrer">Drive</a>' : "");
          L.marker([c.lat, c.lon], { icon: pinIcon, title: p.name, alt: p.name, keyboard: true })
            .addTo(map)
            .bindPopup(body);
        }
        if (pts.length === 1) map.setView(pts[0], 15);
        else map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 13 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [id, pins.map((x) => x.p.id).join(",")]);

  if (!pins.length) return null;

  return (
    <div className="space-y-2">
      <div
        id={`n-pantry-map-${id}`}
        className="n-pantry-map h-64 w-full overflow-hidden rounded-xl border border-border"
        role="region"
        aria-label="Map of food pantries"
      />
      <p className="text-xs text-fg-subtle">Tap a pin, then Drive. Opens Maps on your phone.</p>
    </div>
  );
}
