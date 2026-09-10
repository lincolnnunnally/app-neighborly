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

  // 2b. Pantries must be findable AND must never look verified.
  const pantryHitCount = await page.getByTestId("search-hit-pantry").count();
  ok(pantryHitCount > 0, `"food pantry" returns pantry listings (${pantryHitCount})`,
    'searching "food pantry" returned no pantry listings');
  await page.goto(`${BASE}/c/vidalia?tab=places&cat=pantry`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  const boardPantries = await page.locator('[data-testid^="pantry-pantry_pub"]').count();
  const unconfirmed = await page.getByTestId("pantry-unconfirmed").count();
  ok(boardPantries > 0, `board lists published pantries (${boardPantries})`, "board lists no pantries");
  ok(
    unconfirmed === boardPantries,
    "every published pantry is labelled Unconfirmed",
    `${boardPantries - unconfirmed} published pantries are not labelled Unconfirmed`,
  );
  const pantryText = await page.getByTestId("pantry-section").innerText();
  ok(
    /confirm before you go|call before you go|call ahead/i.test(pantryText),
    "pantry cards tell you to confirm before going",
    "pantry cards omit the call-ahead warning",
  );
  ok(
    /Toombs County Community Resource Guide|directory/i.test(pantryText),
    "pantry cards cite where their facts came from",
    "pantry cards cite no source",
  );
  await page.screenshot({ path: `${SHOTS}/search-pantry-board.png`, fullPage: true });

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
  ok(
    /Bible studies, ministry & ways to serve/i.test(bibleText),
    "bible study offers the Ministry door",
    "bible study offered no Ministry door",
  );
  // Synonym-only hits must never be presented as if they were asked for.
  const directBible = await page
    .locator('[data-testid="search-results"] [data-testid^="search-hit-"]')
    .count();
  const looseBible = await page
    .locator('[data-testid="search-loose"] [data-testid^="search-hit-"]')
    .count();
  ok(
    directBible === 0 ? looseBible >= 0 : true,
    `bible study: ${directBible} direct, ${looseBible} loose`,
    "unexpected bible study result split",
  );
  if (directBible === 0) {
    ok(
      /Nothing on the boards matches/i.test(bibleText),
      "no direct bible-study match is stated plainly",
      "a synonym-only result set was passed off as matches",
    );
  }
  await page.screenshot({ path: `${SHOTS}/search-bible-study.png`, fullPage: true });

  // 3b. The ministry door itself.
  await page.goto(`${BASE}/ministry?place=vidalia`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  ok((await page.getByTestId("ministry-studies").count()) > 0, "ministry lists studies section", "ministry studies section missing");
  ok((await page.getByTestId("ministry-serve").count()) > 0, "ministry lists ways to serve", "ministry serve section missing");
  ok(
    (await page.getByTestId("ministry-get-involved").count()) > 0,
    "ministry offers a way to get involved",
    "ministry offers no way to get involved",
  );
  const ministryText = await page.locator("main").innerText();
  ok(
    /we will not invent a group/i.test(ministryText),
    "ministry empty state stays honest",
    "ministry page lost its honest empty state",
  );
  await page.screenshot({ path: `${SHOTS}/ministry.png`, fullPage: true });

  // 3c. Signing in must return you where you were headed.
  await page.goto(`${BASE}/app/events`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  ok(
    /redirect=%2Fapp%2Fevents/.test(page.url()),
    "signed-out app route keeps its redirect target",
    `login redirect lost the destination: ${page.url()}`,
  );

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
