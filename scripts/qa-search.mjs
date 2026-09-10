/** Exercise free-text search the way a neighbor looking for a food pantry would. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:8080";
// Screenshots stay beside the repo (gitignored), never /tmp.
const SHOTS = process.env.QA_SHOT_DIR || `${process.cwd()}/screenshots`;
mkdirSync(SHOTS, { recursive: true });

// PW_CHROMIUM_PATH lets a runner point at a Chromium it already has when the
// pinned Playwright build is not downloaded (CI images, remote sandboxes).
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const notes = [];
page.on("pageerror", (err) => notes.push(`FAIL pageerror ${err}`));

const ok = (cond, good, bad) => notes.push(cond ? `OK ${good}` : `FAIL ${bad}`);

try {
  // 1. A guest can reach search from the public header.
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(500);
  const headerSearch = page.getByRole("link", { name: "Search" }).first();
  ok((await headerSearch.count()) > 0, "public header has Search", "no Search link in header");
  ok(
    (await page.getByTestId("search-input").count()) > 0,
    "landing page has a free-text search box",
    "landing page has no search box",
  );
  await page.screenshot({ path: `${SHOTS}/search-landing.png`, fullPage: false });

  // 2. The query that started this: "food pantry".
  await page.goto(`${BASE}/search?q=food+pantry`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  const results = page.getByTestId("search-results");
  ok((await results.count()) > 0, "search ran and rendered a result block", "no results block");
  const resultText = await page.locator("main").innerText();
  ok(
    /result|Nothing on the boards/i.test(resultText),
    "search reports a count or an honest empty state",
    "search reported neither results nor an empty state",
  );
  const pantryHits = await page.getByTestId("search-hit-pantry").count();
  notes.push(`INFO pantry hits for "food pantry": ${pantryHits}`);
  ok(
    (await page.getByTestId("search-doors").count()) > 0,
    "doors offered for a food query",
    "no doors offered for a food query",
  );
  await page.screenshot({ path: `${SHOTS}/search-food-pantry.png`, fullPage: true });

  // 3. Free text that is NOT a preset chip — the actual complaint.
  await page.goto(`${BASE}/search?q=bible+study`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  const bibleText = await page.locator("main").innerText();
  ok(
    /bible study/i.test(bibleText),
    "arbitrary phrase search echoes the query",
    "arbitrary phrase search lost the query",
  );
  ok(
    /Churches near you/i.test(bibleText),
    "bible study offers the Churches door",
    "bible study offered no Churches door",
  );
  await page.screenshot({ path: `${SHOTS}/search-bible-study.png`, fullPage: true });

  // 4. Scope chips narrow without hiding the free text.
  await page.goto(`${BASE}/search?q=vidalia`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  ok(
    (await page.getByTestId("search-scope-all").count()) > 0,
    "scope chips rendered",
    "scope chips missing",
  );
  const scopeCount = await page.getByTestId("search-scopes").locator("button").count();
  notes.push(`INFO scopes shown for "vidalia": ${scopeCount}`);
  await page.screenshot({ path: `${SHOTS}/search-scopes.png`, fullPage: true });

  // 5. Board filter: type on the board itself and watch it narrow.
  await page.goto(`${BASE}/c/vidalia?tab=places`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);
  const boardInput = page.getByTestId("board-filter-input");
  ok((await boardInput.count()) > 0, "board has a free-text filter", "board filter missing");
  await boardInput.fill("pantry");
  await page.waitForTimeout(700);
  ok(
    (await page.getByTestId("board-filter-count").count()) > 0,
    "board filter reports how many matched",
    "board filter reported no count",
  );
  const countText = await page.getByTestId("board-filter-count").innerText().catch(() => "");
  notes.push(`INFO board filter says: ${countText.replace(/\s+/g, " ").slice(0, 120)}`);
  ok(
    (await page.getByTestId("places-filter-pantry").count()) > 0,
    "existing category chips still present alongside free text",
    "category chips disappeared",
  );
  await page.waitForTimeout(400);
  ok(/q=pantry/.test(page.url()), "filtered board is shareable via URL", `board URL ${page.url()}`);
  await page.screenshot({ path: `${SHOTS}/search-board-filter.png`, fullPage: true });

  // 6. A query nobody has posted must not invent anything.
  await page.goto(`${BASE}/search?q=zzzqqqnothing`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  const emptyText = await page.locator("main").innerText();
  ok(
    /Nothing on the boards/i.test(emptyText),
    "empty search says so honestly",
    "empty search did not say it found nothing",
  );
  ok(
    (await page.getByTestId("search-hit-need").count()) === 0,
    "empty search invented no results",
    "empty search rendered results anyway",
  );
  await page.screenshot({ path: `${SHOTS}/search-empty.png`, fullPage: true });
} catch (err) {
  notes.push(`FAIL threw ${err}`);
} finally {
  await browser.close();
}

console.log(notes.join("\n"));
if (notes.some((n) => n.startsWith("FAIL"))) process.exitCode = 1;
