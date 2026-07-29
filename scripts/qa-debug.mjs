import { chromium } from "playwright";
const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", e => console.log("PE", e.message));
page.on("console", m => { if (m.type()==="error") console.log("CE", m.text().slice(0,250)); });

await page.goto(base+"/", { waitUntil: "networkidle" });
console.log("landing buttons", await page.getByRole("button").allTextContents());
await page.getByRole("button", { name: /Try Neighborly now/i }).click();
await page.waitForTimeout(5000);
console.log("after try", page.url());
console.log("body", (await page.locator("body").innerText()).slice(0,800));
await page.screenshot({ path: "/workspace/screenshots/qa-debug.png", fullPage: true });
await browser.close();
