import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseIcs,
  parseSidearmIcs,
  parseAverittPerformances,
  parseFestivalDates,
  growthZoneLinks,
  parseGrowthZoneDetail,
  parseSimpleCalendar,
  NOT_A_PUBLIC_OUTING,
} from "../src/lib/events/parse-regional.ts";
import { parseTribe } from "../src/lib/events/parse.ts";
import { chipsFor, chipCounts, filterByChip, isChipId } from "../src/lib/events/chips.ts";
import { DEFAULT_RADIUS_MI, RADIUS_CHOICES, normalizeRadius, wideRadiusFor } from "../src/lib/events/radius.ts";
import { dedupeAcrossSources, normalizeTitle } from "../src/lib/events/search.ts";

const fx = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const TZ = "America/New_York";
const iso = (ms) => new Date(ms).toISOString();

const GS = {
  id: "gseagles",
  organizer: "Georgia Southern Athletics",
  lat: 32.4219,
  lon: -81.7832,
  city: "Statesboro",
  publicHost: "gseagles.com",
  home: /statesboro|clements stadium|convocation center|eagle field|aquatics center at the rac|hanner fieldhouse|paulson stadium|bo pitts|wallis tennis|shooting sports/i,
  shortName: [/^Georgia Southern University\b/, "Georgia Southern"],
};

test("ICS: folded lines and escapes are undone", () => {
  const ev = parseIcs("BEGIN:VEVENT\r\nSUMMARY:A\\, B\r\n  continued\r\nLOCATION:Statesboro\\, Ga.\r\nURL:https://x.test/?a=1&amp;b=2\r\nDTSTART:20261017T170000Z\r\nEND:VEVENT\r\n")[0];
  assert.equal(ev.summary, "A, B continued");
  assert.equal(ev.location, "Statesboro, Ga.");
  assert.equal(ev.url, "https://x.test/?a=1&b=2");
});

test("Sidearm: Georgia Southern home games only, public links, short names, no result prefix", () => {
  const list = parseSidearmIcs(fx("gseagles.ics"), GS, TZ);
  assert.ok(list.length > 50);
  for (const e of list) {
    assert.ok(!/\sat\s/i.test(e.title), `away game kept: ${e.title}`);
    assert.ok(e.url.startsWith(/\svs\.?\s/.test(e.title) ? "https://gseagles.com/sports/" : "https://gseagles.com/"), e.url);
    assert.ok(!e.url.includes("&amp;"));
    assert.ok(!/^\[/.test(e.title));
    assert.equal(e.category, "sports");
  }
  const baseball = list.find((e) => /Baseball vs Winthrop/.test(e.title) && iso(e.startMs) === "2026-10-16T22:00:00.000Z");
  assert.ok(baseball, "Fri baseball vs Winthrop");
  assert.equal(baseball.title, "Georgia Southern Baseball vs Winthrop University");
  assert.equal(baseball.venue, "J.I. Clements Stadium");
  assert.equal(baseball.url, "https://gseagles.com/sports/baseball/schedule");
  const swim = list.find((e) => /Swimming and Diving vs SCAD/.test(e.title));
  assert.equal(swim.url, "https://gseagles.com/sports/swimming-and-diving/schedule");
  const rifle = list.find((e) => /Women's Rifle/.test(e.title));
  assert.equal(rifle.url, "https://gseagles.com/sports/womens-rifle/schedule");
  const vb = list.find((e) => /Volleyball vs Arkansas State/.test(e.title));
  assert.equal(vb.venue, "Hanner Fieldhouse");
  // Neutral-site games (SRP Park in North Augusta) are not home games.
  assert.ok(!list.some((e) => /SRP Park/.test(e.venue)));
});

test("Sidearm: Brewton-Parker home events in Mount Vernon", () => {
  const list = parseSidearmIcs(
    fx("bpcu.ics"),
    { id: "bpcathletics", organizer: "Brewton-Parker Athletics", lat: 32.179, lon: -82.5946, city: "Mount Vernon", publicHost: "bpcuathletics.com",
      home: /mount vernon|mt\.? vernon|gillis gymnasium|bpc (baseball|softball|soccer)/i, shortName: [/^Brewton-Parker College\b/, "Brewton-Parker"] },
    TZ,
  );
  const sat = list.filter((e) => iso(e.startMs).startsWith("2026-10-17"));
  assert.ok(sat.some((e) => /Soccer/.test(e.title)), "Sat women's soccer at home");
  assert.ok(list.every((e) => e.url.startsWith("https://bpcuathletics.com/")));
  assert.equal(sat.find((e) => /Soccer/.test(e.title)).url, "https://bpcuathletics.com/sports/womens-soccer/schedule");
});

test("Averitt Center: title, date, time and the show's own page", () => {
  const list = parseAverittPerformances(
    fx("averitt.html"),
    { id: "averitt", organizer: "Averitt Center for the Arts", lat: 32.4486, lon: -81.7829, city: "Statesboro", base: "https://www.averittcenterforthearts.org", venue: "Averitt Center for the Arts" },
    TZ,
  );
  const t = list.find((e) => /Allman Brothers/.test(e.title));
  assert.ok(t);
  assert.equal(iso(t.startMs), "2026-10-16T23:30:00.000Z"); // 7:30pm EDT
  assert.equal(t.url, "https://www.averittcenterforthearts.org/performances/tribute-a-celebration-of-the-allman-brothers/");
  assert.ok(list.length >= 10);
  assert.ok(list.every((e) => !e.url.includes("tix.com")), "links go to the venue, not the ticket seller");
});

test("Festival page: dates come from the page itself", () => {
  const list = parseFestivalDates(
    fx("headinhome.html"),
    { id: "headinhome", organizer: "Headin' Home Fest", lat: 31.87, lon: -82.59, city: "Hazlehurst", title: "Headin' Home Fest", venue: "Stagger Lee Music Park", url: "https://headinhomefest.com/" },
    TZ,
  );
  // The page lists this fall's dates and next spring's (April 7-11, 2027).
  assert.deepEqual(list.map((e) => iso(e.startMs)), ["2026-10-14T04:00:00.000Z", "2027-04-07T04:00:00.000Z"]);
  assert.ok(list[0].endMs > Date.parse("2026-10-19T03:00:00Z") && list[0].endMs < Date.parse("2026-10-19T04:00:00Z"));
  assert.ok(list[0].multiDay && list[0].allDay);
  assert.deepEqual(parseFestivalDates("<p>Coming soon!</p>", { id: "x", organizer: "x", lat: 0, lon: 0, city: "", title: "x", venue: "", url: "" }, TZ), []);
});

test("GrowthZone: calendar links carry the date; detail page gives the times", () => {
  const links = growthZoneLinks(fx("metter-calendar.html"));
  const fri = links.find((l) => l.dateKey === "2026-10-16");
  assert.ok(fri);
  assert.match(fri.title, /Live Music at Bevricks/);
  const e = parseGrowthZoneDetail(fx("metter-detail.html"), fri, { id: "metter", organizer: "Metter-Candler Chamber", lat: 32.3971, lon: -82.0601, city: "Metter" }, TZ);
  assert.equal(iso(e.startMs), "2026-10-16T22:00:00.000Z"); // 6pm EDT
  assert.equal(iso(e.endMs), "2026-10-17T01:00:00.000Z");
  assert.equal(e.venue, "Bevricks Char House Grille");
  assert.equal(e.url, fri.url);
});

test("Simple Calendar: public market days kept, private holds dropped", () => {
  const list = parseSimpleCalendar(fx("statesboro-market.html"), {
    id: "statesboromarket", organizer: "The Market at Visit Statesboro", lat: 32.4488, lon: -81.7832, city: "Statesboro",
    url: "https://marketatvisitstatesboro.com/availability/", venue: "The Market at Visit Statesboro", keep: /farmers market/i, title: "Statesboro Main Street Farmers Market",
  });
  const sat = list.find((e) => iso(e.startMs) === "2026-10-17T11:00:00.000Z");
  assert.ok(sat, "Sat Oct 17 7am market");
  assert.ok(list.every((e) => e.title === "Statesboro Main Street Farmers Market"));
  assert.ok(!list.some((e) => /reserved/i.test(e.title)));
});

test("Visit Dublin (Tribe): venues carry their own map pins", () => {
  const list = parseTribe(JSON.parse(fx("visitdublin.json")), { id: "visitdublin", organizer: "Visit Dublin-Laurens", lat: 32.54, lon: -82.9, city: "Dublin" }, TZ);
  const chili = list.find((e) => /Chili Cook-Off/.test(e.title));
  assert.ok(chili);
  assert.equal(chili.title, "Downtown Dublin Chili Cook-Off & Fall Festival");
  assert.ok(Math.abs(chili.lat - 32.5372) < 0.001);
});

test("Community-college filter drops classes and office notices, keeps shows", () => {
  for (const t of ["HiSET Testing", "CNA Class", "Spring Registration", "Payment Deadline", "CPR Certification Course"]) assert.ok(NOT_A_PUBLIC_OUTING.test(t), t);
  for (const t of ["Fall Festival", "Holiday Concert Band Showcase".replace("Holiday ", ""), "Car Show"]) assert.ok(!NOT_A_PUBLIC_OUTING.test(t), t);
});

test("Radius: 15/30/60 with 60 default; the drive ring reaches ~100 mi", () => {
  assert.deepEqual([...RADIUS_CHOICES], [15, 30, 60]);
  assert.equal(DEFAULT_RADIUS_MI, 60);
  assert.equal(normalizeRadius(undefined), 60);
  assert.equal(wideRadiusFor(15), 100);
  assert.equal(wideRadiusFor(60), 100);
  assert.equal(wideRadiusFor(120), 120);
});

const ev = (o) => ({ id: o.id, title: o.title, startMs: o.startMs ?? Date.parse("2026-10-17T16:00:00Z"), endMs: null, allDay: false, multiDay: false,
  venue: o.venue ?? "", city: "", lat: o.lat, lon: o.lon, url: "https://x.test", image: null, organizer: "", sourceId: o.sourceId ?? "s", category: o.category ?? "community", free: null, summary: o.summary ?? "" });

test("Cross-source dedupe: same title + day + within a mile is one event", () => {
  const a = ev({ id: "a", title: "The Merry Widow", lat: 32.4219, lon: -81.7832 });
  const b = ev({ id: "b", title: "Merry Widow!", lat: 32.4260, lon: -81.7850 }); // ~0.3 mi away
  const c = ev({ id: "c", title: "Merry Widow", lat: 32.54, lon: -82.9 }); // another town
  const d = ev({ id: "d", title: "Merry Widow", lat: 32.4219, lon: -81.7832, startMs: Date.parse("2026-10-18T19:00:00Z") }); // Sunday
  const out = dedupeAcrossSources([a, b, c, d], TZ).map((e) => e.id);
  assert.deepEqual(out, ["a", "c", "d"]);
  assert.equal(normalizeTitle("Chili Cook-Off &amp; Fall Festival"), normalizeTitle("Chili Cook-Off and Fall Festival"));
});

test("Category chips: keyword + source rules, sports never under arts chips", () => {
  assert.deepEqual(chipsFor(ev({ title: "Headin' Home Fest (bluegrass festival)", category: "festival" })), ["festivals", "music"]);
  assert.ok(chipsFor(ev({ title: "The Merry Widow", category: "arts", sourceId: "gasouthern", summary: "Opera Theatre performance" })).includes("performing"));
  assert.ok(chipsFor(ev({ title: "Wilson Fairchild", sourceId: "averitt" })).includes("performing"));
  assert.ok(chipsFor(ev({ title: "Sometimes the Rain, Sometimes the Sea", category: "arts", venue: "Center for Art & Theatre" })).includes("performing"));
  assert.ok(!chipsFor(ev({ title: "Fall Used Book Sale", venue: "Oconee Regional Library" })).includes("performing"));
  assert.deepEqual(chipsFor(ev({ title: "Statesboro Main Street Farmers Market", category: "food" })), ["markets"]);
  assert.deepEqual(chipsFor(ev({ title: "Georgia Southern Baseball vs Winthrop", category: "sports" })), []);
  assert.ok(chipsFor(ev({ title: "Downtown Dublin Chili Cook-Off & Fall Festival", category: "festival" })).includes("festivals"));
  const list = [ev({ title: "Concert", category: "music" }), ev({ title: "Book Sale" })];
  assert.equal(chipCounts(list).music, 1);
  assert.equal(chipCounts(list).markets, 1);
  assert.equal(filterByChip(list, "markets").length, 1);
  assert.equal(filterByChip(list, undefined).length, 2);
  assert.ok(isChipId("performing") && !isChipId("sports"));
});
