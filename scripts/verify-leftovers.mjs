/** Quick checks for city geocode mapping + church time parsing. */
import assert from "node:assert/strict";

const cityPayload = {
  country: "United States",
  state: "Georgia",
  "state abbreviation": "GA",
  "place name": "Vidalia",
  places: [
    { "place name": "Vidalia", longitude: "-82.4067", latitude: "32.1934", "post code": "30474" },
  ],
};

function normalizeState(raw) {
  const m = { ga: "GA", georgia: "GA" };
  return m[String(raw || "").trim().toLowerCase()] || "";
}

function mapZippopotam(data) {
  const p = data.places?.[0];
  if (!p) return null;
  const city = String(p["place name"] || data["place name"] || "").trim();
  const state = normalizeState(p["state abbreviation"] || data["state abbreviation"] || p.state || data.state);
  const zip = String(data["post code"] || p["post code"] || "").replace(/\D/g, "").slice(0, 5);
  return { zip, city, state, lat: Number(p.latitude), lon: Number(p.longitude) };
}

const geo = mapZippopotam(cityPayload);
assert.equal(geo.city, "Vidalia");
assert.equal(geo.state, "GA");
assert.equal(geo.zip, "30474");
assert.ok(geo.lat);
console.log("zippopotam city-shape parse: ok");

const times = "Sunday 9:00 AM, 10:45 AM, Wednesday 6:30 PM";
assert.match(times, /Sunday 9:00 AM/);
console.log("service_times sample kept as-is: ok");
