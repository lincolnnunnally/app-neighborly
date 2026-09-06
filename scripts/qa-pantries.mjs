/** Exercise Places pantry directory the way a neighbor would. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const notes = [];
page.on("pageerror", (err) => notes.push(`FAIL pageerror ${err}`));

try {
  await page.goto("http://127.0.0.1:8080/c/vidalia?tab=places", {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(800);
  const tab = page.getByRole("tab", { name: "Places" });
  notes.push((await tab.count()) > 0 ? "OK Places tab" : "FAIL Places tab missing");
  const pantrySection = page.getByTestId("pantry-section");
  notes.push((await pantrySection.count()) > 0 ? "OK pantry section" : "FAIL pantry section missing");
  const empty = await page.locator("main").innerText();
  notes.push(
    /will not invent/i.test(empty)
      ? "OK honest empty pantry copy"
      : "FAIL missing honest empty pantry copy",
  );
  notes.push(
    /ChurchConnect Get Help/i.test(empty)
      ? "OK CC Get Help link"
      : "FAIL missing ChurchConnect Get Help",
  );
  notes.push(
    /Reservable|Recreation Complex|PAL Theatre|library/i.test(empty)
      ? "OK reservable places still listed"
      : "WARN reservable places not visible",
  );
  await page.screenshot({ path: "/workspace/screenshots/places-pantry-empty.png", fullPage: true });

  await page.getByTestId("places-filter-pantry").click();
  await page.waitForTimeout(400);
  notes.push(
    /tab=places/.test(page.url()) && /cat=pantry/.test(page.url())
      ? "OK shareable pantry URL kept cat=pantry"
      : `FAIL pantry filter URL ${page.url()}`,
  );
  await page.screenshot({ path: "/workspace/screenshots/places-pantry-filter.png", fullPage: true });

  const cta = page.getByTestId("add-pantry-empty").or(page.getByTestId("add-pantry")).first();
  await cta.click();
  await page.waitForURL(/\/(signup|app\/places)/, { timeout: 15000 });
  notes.push(
    /signup|app\/places/.test(page.url())
      ? `OK Add pantry CTA landed ${page.url().replace(/^https?:\/\/[^/]+/, "")}`
      : `FAIL Add pantry CTA landed ${page.url()}`,
  );
  if (page.url().includes("/signup")) {
    notes.push(
      /next=%2Fapp%2Fplaces|next=\/app\/places/.test(page.url())
        ? "OK signup next=/app/places"
        : `FAIL signup missing pantry next (${page.url()})`,
    );
  }
  await page.screenshot({ path: "/workspace/screenshots/places-pantry-cta.png", fullPage: true });
} finally {
  await browser.close();
}

console.log(notes.join("\n"));
if (notes.some((n) => n.startsWith("FAIL"))) process.exit(1);
