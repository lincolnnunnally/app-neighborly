import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const email = `neighbor_${Date.now()}@example.com`;
const password = "testpass123";

await page.goto(`${base}/signup?community=milstead&code=MILSTEAD-WELCOME`, { waitUntil: "networkidle" });
await page.fill("#name", "Lincoln N.");
await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');
await page.waitForURL(/onboarding/, { timeout: 20000 });
await page.waitForSelector("#displayName", { timeout: 10000 });
await page.fill("#displayName", "Lincoln N.");
await page.getByRole("button", { name: "Continue to communities" }).click();
await page.waitForSelector("text=Your communities", { timeout: 10000 });
await page.getByRole("button", { name: "Continue to notifications" }).click();
await page.waitForSelector("text=What should we notify you about?", { timeout: 10000 });
await page.getByRole("button", { name: "Enter Neighborly" }).click();
await page.waitForURL(/\/app/, { timeout: 20000 });
await page.waitForSelector("text=Your hub", { timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/app-hub.png", fullPage: true });
const body = await page.locator("body").innerText();
console.log(JSON.stringify({
  url: page.url(),
  hasHub: body.includes("Your hub"),
  bodySnippet: body.slice(0, 700),
  errors,
}, null, 2));
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "/workspace/screenshots/app-mobile.png", fullPage: true });
await browser.close();
