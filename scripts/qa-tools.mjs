/** Exercise the Tools borrow door the way a neighbor would. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

try {
  await page.goto("http://127.0.0.1:8080/c/vidalia?tab=tools", {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(800);
  const tab = page.getByRole("tab", { name: "Tools" });
  if (!(await tab.count())) throw new Error("Tools tab missing");
  await page.screenshot({ path: "/workspace/screenshots/tools-board-empty.png", fullPage: true });

  const listCta = page.getByTestId("list-tool-empty").or(page.getByTestId("list-tool")).first();
  await listCta.click();
  await page.waitForURL(/\/(signup|app\/tools)/, { timeout: 15000 });
  await page.screenshot({ path: "/workspace/screenshots/tools-list-cta.png", fullPage: true });

  if (page.url().includes("/signup")) {
    if (!page.url().includes("next=")) throw new Error("signup missing next=/app/tools");
    await page.locator("#name").fill("Lincoln QA");
    await page.locator("#email").fill(`tools.qa.${Date.now()}@example.com`);
    await page.locator("#password").fill("neighborly-tools-qa");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 20000 });
    await page.waitForTimeout(400);
    if (await page.locator("#displayName").isVisible().catch(() => false)) {
      await page.locator("#displayName").fill("Lincoln QA");
      await page.locator("button:has-text('Continue')").last().click();
      await page.waitForTimeout(800);
    }
    if (await page.getByRole("button", { name: /See groups that fit/ }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /See groups that fit/ }).click();
      await page.waitForTimeout(800);
    }
    if (await page.getByRole("button", { name: /Continue to next steps/ }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Continue to next steps/ }).click();
      await page.waitForTimeout(500);
    }
    await page.getByRole("button", { name: /Enter Neighborly/ }).click();
    await page.waitForURL(/\/app\/tools/, { timeout: 20000 });
  }

  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/tools-hub.png", fullPage: true });
  if (!page.url().includes("/app/tools")) throw new Error(`expected /app/tools, got ${page.url()}`);

  const banner = await page.getByTestId("tools-payments-banner").innerText();
  if (!/Payments coming soon/i.test(banner)) throw new Error(`bad payments banner: ${banner}`);

  if (!(await page.locator("input").first().count())) {
    await page.getByRole("button", { name: "List a tool" }).click();
    await page.waitForTimeout(300);
  }
  await page.locator("input").first().fill("Honda push mower");
  await page.locator("textarea").first().fill("Runs, bag included, pickup near the high school.");
  const attest = page.getByText(/It runs and is ready/);
  if (await attest.count()) await attest.click();
  await page.getByRole("button", { name: "Publish tool" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/workspace/screenshots/tools-listed.png", fullPage: true });
  const listed = await page.getByText("Honda push mower").count();
  if (!listed) throw new Error("listed tool not visible on /app/tools");

  await page.goto("http://127.0.0.1:8080/c/vidalia?tab=tools", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/tools-board-listed.png", fullPage: true });
  if (!(await page.getByText("Honda push mower").count())) {
    throw new Error("listed tool not on public board");
  }
  await page.getByText("Honda push mower").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/tools-detail.png", fullPage: true });
  const detail = await page.getByText(/\$25/).count();
  if (!detail) throw new Error("daily rate missing on detail");
  const own = await page.getByRole("button", { name: /Request borrow/ }).isDisabled();
  if (!own) throw new Error("owner should not request their own tool");

  if (errors.length) {
    console.error("page errors", errors);
    process.exit(2);
  }
  console.log("tools door QA: ok");
} catch (err) {
  await page.screenshot({ path: "/workspace/screenshots/tools-qa-fail.png", fullPage: true }).catch(() => {});
  console.error(err);
  console.error("url", page.url());
  process.exit(1);
} finally {
  await browser.close();
}
