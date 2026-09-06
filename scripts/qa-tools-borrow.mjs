/** Second neighbor books the listed mower. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function onboard(page, name, email) {
  await page.goto("http://127.0.0.1:8080/signup?community=vidalia&code=VIDALIA-WELCOME&next=%2Fc%2Fvidalia%3Ftab%3Dtools", {
    waitUntil: "networkidle",
  });
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("neighborly-tools-qa");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 20000 });
  await page.waitForTimeout(400);
  if (await page.locator("#displayName").isVisible().catch(() => false)) {
    await page.locator("#displayName").fill(name);
    await page.locator("button:has-text('Continue')").last().click();
    await page.waitForTimeout(700);
  }
  if (await page.getByRole("button", { name: /See groups that fit/ }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /See groups that fit/ }).click();
    await page.waitForTimeout(700);
  }
  if (await page.getByRole("button", { name: /Continue to next steps/ }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Continue to next steps/ }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /Enter Neighborly/ }).click();
  await page.waitForURL(/\/(app\/tools|c\/vidalia)/, { timeout: 20000 });
}

try {
  await onboard(page, "Borrower QA", `borrow.qa.${Date.now()}@example.com`);
  await page.goto("http://127.0.0.1:8080/c/vidalia?tab=tools", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByText("Honda push mower").first().click();
  await page.waitForTimeout(300);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  const iso = (d) => d.toISOString().slice(0, 10);
  await page.locator('input[type="date"]').nth(0).fill(iso(start));
  await page.locator('input[type="date"]').nth(1).fill(iso(end));
  await page.locator("textarea").fill("I'll meet you Saturday morning by the high school.");
  await page.getByRole("button", { name: /Request borrow/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/workspace/screenshots/tools-borrowed.png", fullPage: true });
  const toast = await page.locator("[data-sonner-toast], [data-sonner-toaster]").innerText().catch(() => "");
  if (!/coming soon|reserved|Payment/i.test(toast) && !/coming soon|reserved/i.test(await page.content())) {
    console.log("toast", toast);
  }
  await page.goto("http://127.0.0.1:8080/app/tools", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/workspace/screenshots/tools-borrower-hub.png", fullPage: true });
  const reserved = await page.getByText(/Honda push mower/).count();
  const coming = await page.getByText(/Payments coming soon/).count();
  if (!reserved) throw new Error("booking not on borrower hub");
  if (!coming) throw new Error("payments banner missing after book");
  console.log("tools borrow QA: ok");
} catch (err) {
  await page.screenshot({ path: "/workspace/screenshots/tools-borrow-fail.png", fullPage: true }).catch(() => {});
  console.error(err);
  console.error("url", page.url());
  process.exit(1);
} finally {
  await browser.close();
}
