/**
 * Exercise leftover finish paths the way Lincoln would.
 * Writes screenshots under /workspace/screenshots/.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.QA_BASE || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const notes = [];

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

try {
  await page.goto(`${BASE}/weekend?place=vidalia`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const weekendText = await page.locator("main").innerText();
  if (/No dated listings in this window yet/.test(weekendText) && !/pickleball|Celebrate Recovery|Lip Sync|Girls Night Out|Downtown Vidalia/i.test(weekendText)) {
    notes.push("FAIL weekend empty of board listings");
  } else if (!/Lip Sync|Celebrate Recovery|Girls Night Out|Downtown Vidalia/i.test(weekendText)) {
    notes.push("FAIL weekend missing dated Vidalia board events (Sep 10–12 range)");
  } else {
    notes.push("OK weekend shows dated listings");
  }
  await shot("weekend-vidalia");

  await page.getByRole("button", { name: /meeting/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await shot("weekend-kind-filter");
  await page.getByRole("button", { name: /All kinds/i }).click().catch(() => {});

  await page.goto(`${BASE}/c/vidalia`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const board = await page.locator("main").innerText();
  notes.push(/Celebrate Recovery|pickleball|Downtown Vidalia|Lip Sync/i.test(board) ? "OK board has events" : "WARN board events not visible in first paint");
  await page.getByRole("button", { name: /This week/i }).first().click().catch(() => {});
  await shot("board-vidalia");

  await page.goto(`${BASE}/near`, { waitUntil: "networkidle", timeout: 30000 });
  await page.getByLabel("City or ZIP").fill("Vidalia, GA");
  await page.getByRole("button", { name: /What's going on/i }).click();
  await page.waitForURL(/weekend/, { timeout: 15000 });
  notes.push(page.url().includes("vidalia") ? "OK city lookup → vidalia" : `FAIL city lookup landed ${page.url()}`);
  await shot("near-vidalia-ga");

  await page.goto(`${BASE}/near`, { waitUntil: "networkidle", timeout: 30000 });
  await page.getByLabel("City or ZIP").fill("Savannah, GA");
  await page.getByRole("button", { name: /What's going on/i }).click();
  await page.waitForTimeout(1200);
  const nearText = await page.locator("main").innerText();
  notes.push(
    /no Neighborly board yet/i.test(nearText)
      ? "OK savannah did not auto-create"
      : "WARN savannah confirm prompt missing",
  );
  await shot("near-savannah-confirm");

  await page.goto(`${BASE}/churches?zip=30474`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  notes.push(
    /[?&]zip=30474/.test(page.url())
      ? "OK churches URL kept zip=30474"
      : `FAIL churches dropped zip (${page.url()})`,
  );
  const churchText = await page.locator("main").innerText();
  notes.push(
    /FIRST BAPTIST CHURCH VIDALIA/i.test(churchText)
      ? "OK churches lists First Baptist Vidalia"
      : "FAIL churches missing FBC Vidalia",
  );
  notes.push(/ChurchConnect/i.test(churchText) ? "OK churches credits CC" : "WARN no CC credit");
  await shot("churches-vidalia");

  await page.getByRole("button", { name: /This morning/i }).click();
  await page.getByRole("button", { name: /Find churches/i }).click();
  await page.waitForTimeout(1200);
  await shot("churches-morning-filter");

  await page.goto(`${BASE}/c/vidalia?tab=services`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const servicesText = await page.locator("main").innerText();
  notes.push(
    /Offer a service/i.test(servicesText)
      ? "OK services tab has Offer CTA"
      : "FAIL services tab missing Offer CTA",
  );
  notes.push(
    /Maker \/ artisan|Woodworking|Fiber, textile/i.test(servicesText)
      ? "OK maker categories visible"
      : "WARN maker categories not in first paint (filters after listings)",
  );
  notes.push(
    /tab=services/.test(page.url())
      ? "OK shareable services URL kept tab=services"
      : `FAIL services URL dropped tab (${page.url()})`,
  );
  await shot("board-services");

  await page.goto(`${BASE}/c/vidalia?tab=places&cat=pantry`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const placesText = await page.locator("main").innerText();
  notes.push(
    /Add a pantry listing/i.test(placesText)
      ? "OK places pantry CTA"
      : "FAIL places pantry CTA missing",
  );
  notes.push(
    /will not invent/i.test(placesText)
      ? "OK pantry empty is honest"
      : "FAIL pantry empty invented or missing",
  );
  notes.push(
    /tab=places/.test(page.url()) && /cat=pantry/.test(page.url())
      ? "OK shareable pantry URL kept tab=places&cat=pantry"
      : `FAIL pantry URL dropped filter (${page.url()})`,
  );
  await shot("board-places-pantry");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 });
  const homeOffer = page.getByRole("link", { name: /Offer skills & services/i });
  notes.push((await homeOffer.count()) > 0 ? "OK home Offer skills card" : "FAIL home Offer card missing");
  await homeOffer.first().click();
  await page.waitForTimeout(800);
  notes.push(
    /signup|app\/services|login/i.test(page.url())
      ? `OK Offer deep-link landed ${page.url().replace(/^https?:\/\/[^/]+/, "")}`
      : `FAIL Offer deep-link landed ${page.url()}`,
  );
  await shot("home-offer-deeplink");
} finally {
  await browser.close();
}

console.log(notes.join("\n"));
if (notes.some((n) => n.startsWith("FAIL"))) process.exit(1);
