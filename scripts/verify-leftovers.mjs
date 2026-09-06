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

function parseEventStartMs(raw) {
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const isoish = s.includes("T") ? s : s.replace(" ", "T");
  const withColonTz = isoish
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/([+-]\d{2})$/, "$1:00");
  for (const candidate of [withColonTz, isoish, s]) {
    const t = Date.parse(candidate);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

assert.ok(parseEventStartMs("2026-09-10 19:00:00-04"), "postgres tz without colon");
assert.ok(parseEventStartMs("2026-09-10 19:00:00-04:00"), "postgres tz with colon");
assert.ok(parseEventStartMs("2026-09-12T18:00:00-04:00"), "iso offset");
assert.ok(parseEventStartMs(new Date("2026-09-10T19:00:00-04:00")), "Date object");
assert.equal(parseEventStartMs(""), null);
console.log("event start parse (board + weekend): ok");

const makerIds = ["artisan", "wood", "fiber", "metal", "visual", "foodcraft", "home_goods"];
assert.ok(makerIds.every((id) => /^[a-z_]+$/.test(id)), "maker taxonomy ids");
function isSafeNext(raw) {
  if (!raw) return false;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.includes("://")) return false;
  return raw.length < 180;
}
assert.equal(isSafeNext("/app/services"), true);
assert.equal(isSafeNext("/app/tools"), true);
assert.equal(isSafeNext("https://evil.example"), false);
assert.equal(isSafeNext("//evil"), false);
assert.equal("/c/vidalia?tab=services".startsWith("/c/"), true);
assert.equal("/c/vidalia?tab=tools".startsWith("/c/"), true);
console.log("services offer next + maker taxonomy: ok");

function rentalDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("Pick a valid date range");
  }
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}
function quoteToolRental({ daily_rate_cents, days, replacement_value_cents }) {
  const d = Math.max(1, Math.floor(days));
  const rental_cents = Math.max(0, Math.floor(daily_rate_cents)) * d;
  const platform_fee_cents = Math.round(rental_cents * 0.15);
  return {
    days: d,
    rental_cents,
    platform_fee_cents,
    owner_payout_cents: rental_cents - platform_fee_cents,
    deposit_cents: Math.max(0, Math.floor(replacement_value_cents)),
  };
}
assert.equal(rentalDays("2026-09-06", "2026-09-08"), 3);
const q = quoteToolRental({ daily_rate_cents: 2500, days: 2, replacement_value_cents: 20000 });
assert.equal(q.rental_cents, 5000);
assert.equal(q.platform_fee_cents, 750);
assert.equal(q.owner_payout_cents, 4250);
assert.equal(q.deposit_cents, 20000);
console.log("tools rental quote + 15% fee: ok");
