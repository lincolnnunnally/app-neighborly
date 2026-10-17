import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  weekendWindow,
  localDateKey,
  overlapsWindow,
  parseWallTime,
  zonedToUtcMs,
} from "../src/lib/events/time.ts";
import { parseGaParks, parseLocalist, parsePalShows, parseTribe, isPublicLocalistEvent } from "../src/lib/events/parse.ts";
import { GA_PARK_COORDS } from "../src/lib/events/ga-parks.ts";

const fx = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const TZ = "America/New_York";

test("Saturday just after midnight Eastern is still this weekend (no UTC rollover)", () => {
  // Sat Oct 17 2026 00:12 EDT = 04:12Z
  const now = Date.parse("2026-10-17T04:12:00Z");
  const w = weekendWindow(now, TZ);
  assert.equal(w.friKey, "2026-10-16");
  assert.equal(w.sunKey, "2026-10-18");
  assert.equal(new Date(w.startMs).toISOString(), "2026-10-16T21:00:00.000Z"); // Fri 5pm EDT
  assert.equal(new Date(w.endMs).toISOString(), "2026-10-19T04:00:00.000Z"); // Mon 00:00 EDT
  assert.equal(w.label, "Fri, Oct 16 – Sun, Oct 18");
});

test("Thursday 11pm Eastern (already Friday in UTC) looks ahead to this Friday", () => {
  const now = Date.parse("2026-10-16T03:30:00Z"); // Thu Oct 15 23:30 EDT
  assert.equal(localDateKey(now, TZ), "2026-10-15");
  assert.equal(weekendWindow(now, TZ).friKey, "2026-10-16");
});

test("Sunday night Eastern (Monday in UTC) is still this weekend", () => {
  const now = Date.parse("2026-10-19T02:00:00Z"); // Sun Oct 18 22:00 EDT
  assert.equal(weekendWindow(now, TZ).friKey, "2026-10-16");
  assert.equal(weekendWindow(now, TZ, 1).friKey, "2026-10-23");
});

test("DST: the weekend after the fall-back change ends at Monday midnight EST", () => {
  const now = Date.parse("2026-11-04T15:00:00Z"); // Wed Nov 4
  const w = weekendWindow(now, TZ);
  assert.equal(w.friKey, "2026-11-06");
  assert.equal(new Date(w.startMs).toISOString(), "2026-11-06T22:00:00.000Z"); // 5pm EST
});

test("wall times without an offset are read in the place's zone", () => {
  assert.equal(new Date(parseWallTime("2026-10-17 10:00:00", TZ)).toISOString(), "2026-10-17T14:00:00.000Z");
  assert.equal(new Date(parseWallTime("2026-10-17T10:00:00-04:00", TZ)).toISOString(), "2026-10-17T14:00:00.000Z");
  assert.equal(zonedToUtcMs(2026, 12, 1, 9, 0, TZ), Date.parse("2026-12-01T14:00:00Z"));
});

test("overlap hides what already ended but keeps what is still running", () => {
  const w = weekendWindow(Date.parse("2026-10-17T16:00:00Z"), TZ); // Sat noon
  const now = Date.parse("2026-10-17T16:00:00Z");
  const ended = { startMs: Date.parse("2026-10-16T22:00:00Z"), endMs: Date.parse("2026-10-16T23:00:00Z"), allDay: false };
  const running = { startMs: Date.parse("2026-10-17T14:00:00Z"), endMs: Date.parse("2026-10-17T20:00:00Z"), allDay: false };
  const fridayMorning = { startMs: Date.parse("2026-10-16T13:00:00Z"), endMs: null, allDay: false };
  assert.equal(overlapsWindow(ended, w, now), false);
  assert.equal(overlapsWindow(running, w, now), true);
  assert.equal(overlapsWindow(fridayMorning, w, Date.parse("2026-10-16T12:00:00Z")), false);
});

test("Tribe parser ignores a site's wrong 'UTC' field and uses local time", () => {
  const events = parseTribe(JSON.parse(fx("tribe-ponce.json")), { id: "poncecity", organizer: "Ponce City Market", lat: 33.77, lon: -84.36, city: "Atlanta" }, TZ);
  assert.ok(events.length > 0);
  const run = events.find((e) => /run club/i.test(e.title));
  if (run) assert.equal(new Date(run.startMs).toISOString(), "2026-10-17T12:00:00.000Z"); // 8am EDT
  for (const e of events) {
    assert.ok(e.lat && e.lon, "falls back to venue coords");
    assert.ok(!/&#\d+;/.test(e.title), "entities decoded");
  }
});

test("Localist parser keeps public events and drops campus admin noise", () => {
  const events = parseLocalist(JSON.parse(fx("localist-gasouthern.json")), { id: "gasouthern", organizer: "Georgia Southern University" }, TZ);
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => !/class project|meeting|webinar|chartering/i.test(e.title)));
  assert.ok(events.every((e) => Number.isFinite(e.lat)));
  assert.equal(isPublicLocalistEvent({ title: "Withdrawal Period - Full Semester", filters: { event_types: [{ name: "Academic Calendar" }] } }), false);
  assert.equal(isPublicLocalistEvent({ title: "Fall Concert", experience: "inperson", filters: { event_types: [{ name: "Arts, Culture and Entertainment" }] } }), true);
});

test("State parks parser reads dated rows and maps parks to coordinates", () => {
  const events = parseGaParks(fx("gaparks-events.html"), GA_PARK_COORDS, TZ);
  assert.ok(events.length >= 100, `got ${events.length}`);
  const birds = events.find((e) => /Birds of Prey/.test(e.title) && /Amicalola/.test(e.venue));
  assert.ok(birds);
  assert.equal(new Date(birds.startMs).toISOString(), "2026-10-17T17:00:00.000Z"); // 1 PM EDT
  const unmatched = new Set();
  for (const m of fx("gaparks-events.html").matchAll(/View event details for ([^-']+) - /g)) {
    if (!GA_PARK_COORDS[m[1].trim().replace(/&amp;/g, "&")]) unmatched.add(m[1].trim());
  }
  assert.deepEqual([...unmatched], []);
});

test("Pal Theatre parser reads its show list with the right year", () => {
  const now = Date.parse("2026-10-17T04:12:00Z");
  const shows = parsePalShows(fx("pal-shows.html"), now, TZ);
  const salsa = shows.find((s) => /Spooky Salsa/.test(s.title));
  assert.ok(salsa, JSON.stringify(shows.map((s) => s.title)));
  assert.equal(localDateKey(salsa.startMs, TZ), "2026-10-24");
  assert.equal(new Date(salsa.startMs).toISOString(), "2026-10-24T21:30:00.000Z"); // 5:30pm EDT
  const addams = shows.filter((s) => /Addams/.test(s.title));
  assert.equal(addams.length, 2);
});

import { groupMultiVenue } from "../src/lib/events/search.ts";
import { normalizePlaceQuery } from "../src/lib/community/place-query.ts";

test("one watch party at 3 bars becomes one card with 2 other places", () => {
  const base = { startMs: Date.UTC(2026, 9, 17, 19, 30), endMs: null, allDay: false, multiDay: false, city: "Atlanta", lat: 33.7, lon: -84.4, url: "https://x", image: null, organizer: "UGA", sourceId: "uga", category: "sports", free: true, summary: "" };
  const out = groupMultiVenue([
    { ...base, id: "a", title: "Atlanta Chapter: Game Watching Party - UGA vs Auburn", venue: "Bar One", distanceMi: 3 },
    { ...base, id: "b", title: "Atlanta Chapter: Game-Watching Party — UGA vs Auburn", venue: "Bar Two", distanceMi: 1 },
    { ...base, id: "c", title: "Atlanta Chapter: Game Watching Party - UGA vs Auburn", venue: "Bar Three", distanceMi: 5 },
    { ...base, id: "d", title: "Green Market", venue: "Piedmont Park", distanceMi: 2 },
  ]);
  assert.equal(out.length, 2);
  const party = out.find((e) => e.id === "b");
  assert.equal(party.venue, "Bar Two");
  assert.equal(party.otherPlaces.length, 2);
  assert.equal(out.find((e) => e.id === "d").otherPlaces, undefined);
});

test("free-form place input prefers a ZIP anywhere, else keeps City, ST", () => {
  assert.equal(normalizePlaceQuery("Vidalia GA 30474"), "30474");
  assert.equal(normalizePlaceQuery("Vidalia, GA 30474"), "30474");
  assert.equal(normalizePlaceQuery("30474-1234"), "30474");
  assert.equal(normalizePlaceQuery(30303), "30303");
  assert.equal(normalizePlaceQuery("  Vidalia ,  GA "), "Vidalia, GA");
  assert.equal(normalizePlaceQuery("Atlanta, GA, USA"), "Atlanta, GA");
  assert.equal(normalizePlaceQuery("Vidalia GA"), "Vidalia GA");
});
