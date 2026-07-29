import { chromium } from "playwright";
const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const log = [];
page.on("pageerror", e => log.push("PE:"+e.message));
page.on("console", m => { if (m.type()==="error") log.push("CE:"+m.text()); });

await page.goto(base+"/", { waitUntil: "networkidle" });
// count links and buttons
const links = await page.locator("a").all();
const btns = await page.locator("button").all();
log.push(`landing links=${links.length} buttons=${btns.length}`);

// click communities nav
await page.getByRole("link", { name: "Communities" }).first().click();
await page.waitForTimeout(1000);
log.push("communities url="+page.url());
const openLinks = await page.getByRole("link", { name: "Open" }).count();
log.push("open links="+openLinks);
if (openLinks) {
  await page.getByRole("link", { name: "Open" }).first().click();
  await page.waitForTimeout(1500);
  log.push("after open="+page.url());
  // tabs
  for (const t of ["Services","Events","Places","People","Needs"]) {
    const tab = page.getByRole("tab", { name: t });
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(400);
      log.push(`tab ${t} body has content=${(await page.locator("body").innerText()).length}`);
    }
  }
  // I can help as guest
  await page.getByRole("tab", { name: "Needs" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /I can help/i }).first().click();
  await page.waitForTimeout(800);
  log.push("toast/help: "+(await page.locator("body").innerText()).slice(-200));
}

// Join free from header
await page.goto(base+"/");
await page.getByRole("link", { name: /Join free/i }).click();
await page.waitForTimeout(1000);
log.push("join free url="+page.url());

// I have invite
await page.goto(base+"/");
await page.getByRole("link", { name: /I have an invite code/i }).click();
await page.waitForTimeout(1500);
log.push("invite url="+page.url());
log.push("invite body snippet="+(await page.locator("body").innerText()).slice(0,300));

console.log(JSON.stringify(log,null,2));
await browser.close();
