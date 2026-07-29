import { chromium } from "playwright";
const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const log = [];
page.on("pageerror", e => log.push("PE:"+e.message));
page.on("console", m => { if (m.type()==="error") log.push("CE:"+m.text().slice(0,160)); });
const has = async (s) => (await page.locator("body").innerText()).includes(s);

await page.goto(base+"/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Try Neighborly now/i }).click();
await page.waitForURL(/\/app/, { timeout: 30000 });
await page.waitForSelector("text=Your hub", { timeout: 15000 });
log.push("1 hub ok");

await page.goto(base+"/c/milstead", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const needBtn = page.getByRole("button", { name: /porch lightbulbs/i });
log.push("need btn count "+await needBtn.count());
await needBtn.first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /I can help/i }).click();
await page.waitForTimeout(3000);
log.push("2 help: " + ((await has("Help offered")) || (await has("already offered")) || (await has("offers so far")) || (await has("offered"))));
await page.screenshot({ path: "/workspace/screenshots/qa2-help.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.getByRole("tab", { name: "Events" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /block party/i }).first().click();
await page.waitForTimeout(500);
if (await page.getByRole("button", { name: /^RSVP$/i }).count()) {
  await page.getByRole("button", { name: /^RSVP$/i }).click();
  await page.waitForTimeout(2000);
}
log.push("3 rsvp: " + ((await has("Going")) || (await has("Cancel RSVP")) || (await has("on the list"))));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.getByRole("tab", { name: "Places" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Community Center|picnic pavilion|pool pavilion/i }).first().click();
await page.waitForTimeout(500);
await page.locator('[role=dialog] input').first().fill("Kids birthday");
await page.locator('[role=dialog] input[type=date]').fill("2026-08-15");
await page.getByRole("button", { name: /Request reservation/i }).click();
await page.waitForTimeout(2500);
log.push("4 book: " + ((await has("Reservation requested")) || (await has("requested"))));
await page.screenshot({ path: "/workspace/screenshots/qa2-places.png" });

await page.goto(base+"/app/needs", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Post a need/i }).click();
await page.locator("form input").first().fill("Need help with groceries");
await page.locator("form textarea").first().fill("This Friday");
await page.getByRole("button", { name: /Publish need/i }).click();
await page.waitForTimeout(1500);
log.push("5 post: " + await has("groceries"));

await page.goto(base+"/app/invite", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /New personal code/i }).click();
await page.waitForTimeout(1200);
const t = await page.locator("body").innerText();
log.push("6 code: " + (t.match(/NBR-[A-Z0-9]+/)?.[0] || "none"));

await page.goto(base+"/app", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
log.push("7 activity section: " + await has("Your activity"));
await page.screenshot({ path: "/workspace/screenshots/qa2-hub-final.png", fullPage: true });

console.log(JSON.stringify(log, null, 2));
await browser.close();
