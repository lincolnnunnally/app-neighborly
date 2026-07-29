import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const log = [];
page.on("pageerror", (e) => log.push("PAGEERR " + e.message));
page.on("console", (m) => { if (m.type() === "error") log.push("CONSOLE " + m.text()); });

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

// 1. Landing
await page.goto(base + "/", { waitUntil: "networkidle" });
await shot("qa-landing");
const join = page.getByRole("link", { name: /Join Milstead/i }).first();
log.push("join visible: " + (await join.isVisible()));
await join.click();
await page.waitForTimeout(1500);
log.push("after join click url: " + page.url());
await shot("qa-after-join");

// signup flow
const email = `qa_${Date.now()}@test.com`;
if (page.url().includes("signup")) {
  await page.fill("#name", "QA Tester");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(2500);
  log.push("after signup: " + page.url());
  await shot("qa-onboarding");
  
  if (page.url().includes("onboarding")) {
    const dn = page.locator("#displayName");
    if (await dn.count()) await dn.fill("QA Tester");
    // skill
    const skill = page.getByRole("button", { name: "Handyman" });
    if (await skill.count()) await skill.click();
    await page.getByRole("button", { name: /Continue to communities/i }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /Continue to notifications/i }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Enter Neighborly/i }).click();
    await page.waitForTimeout(2500);
    log.push("after onboard: " + page.url());
    await shot("qa-hub");
  }
}

// Try needs page post
if (page.url().includes("/app")) {
  await page.getByRole("link", { name: "Needs" }).first().click();
  await page.waitForTimeout(1000);
  log.push("needs url: " + page.url());
  await shot("qa-needs");
  
  const post = page.getByRole("button", { name: /Post a need/i });
  if (await post.count()) {
    await post.click();
    await page.waitForTimeout(500);
    const title = page.locator('input[placeholder*="ceiling"], input[placeholder*="Help"]').first();
    // find title input in form
    const inputs = page.locator("form input");
    if (await inputs.count() > 0) {
      await inputs.first().fill("Need help hanging a picture");
      await page.locator("form textarea").first().fill("Saturday morning preferred");
      await page.getByRole("button", { name: /Publish need/i }).click();
      await page.waitForTimeout(1500);
      log.push("after publish need body has picture: " + (await page.locator("body").innerText()).includes("picture"));
      await shot("qa-need-posted");
    }
  }
  
  // Services
  await page.getByRole("link", { name: "Services" }).first().click();
  await page.waitForTimeout(800);
  const reg = page.getByRole("button", { name: /Register a service/i });
  if (await reg.count()) {
    await reg.click();
    await page.waitForTimeout(400);
    const formInputs = page.locator("form input");
    if (await formInputs.count()) {
      await formInputs.first().fill("Weekend yard cleanup");
      await page.locator("form textarea").first().fill("I clean yards on weekends");
      await page.getByRole("button", { name: /Publish service/i }).click();
      await page.waitForTimeout(1200);
      log.push("service posted: " + (await page.locator("body").innerText()).includes("yard cleanup"));
    }
  }
  await shot("qa-services");
  
  // Events RSVP
  await page.getByRole("link", { name: "Events" }).first().click();
  await page.waitForTimeout(800);
  const rsvp = page.getByRole("button", { name: /^RSVP$/i }).first();
  if (await rsvp.count()) {
    await rsvp.click();
    await page.waitForTimeout(1000);
    log.push("rsvp after: " + (await page.locator("body").innerText()).slice(0, 300));
  }
  await shot("qa-events");
  
  // Invite
  await page.getByRole("link", { name: "Invite" }).first().click();
  await page.waitForTimeout(800);
  await shot("qa-invite");
  const copy = page.getByRole("button", { name: /Copy link/i });
  if (await copy.count()) {
    await copy.click();
    await page.waitForTimeout(500);
    log.push("copy clicked");
  }
  const newCode = page.getByRole("button", { name: /New personal code/i });
  if (await newCode.count()) {
    await newCode.click();
    await page.waitForTimeout(1000);
    log.push("new code body: " + (await page.locator("body").innerText()).match(/NBR-[A-Z0-9]+/)?.[0]);
  }
  
  // public milstead - offer help
  await page.goto(base + "/c/milstead", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const help = page.getByRole("button", { name: /I can help/i }).first();
  if (await help.count()) {
    await help.click();
    await page.waitForTimeout(1000);
    log.push("help offer done");
  }
  await shot("qa-public-milstead");
}

// Guest path - open community card from landing without auth
await page.context().clearCookies();
// clear storage
await page.goto(base + "/");
await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
await page.goto(base + "/", { waitUntil: "networkidle" });
const openMil = page.getByRole("link", { name: /Open Milstead community/i });
if (await openMil.count()) {
  await openMil.click();
  await page.waitForTimeout(1500);
  log.push("guest milstead url: " + page.url());
  await shot("qa-guest-milstead");
  // click a tab
  const servicesTab = page.getByRole("tab", { name: /Services/i });
  if (await servicesTab.count()) {
    await servicesTab.click();
    await page.waitForTimeout(500);
    log.push("services tab text len: " + (await page.locator("body").innerText()).length);
  }
}

console.log(JSON.stringify(log, null, 2));
await browser.close();
