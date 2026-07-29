import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const reqs = [];
page.on("request", r => { if (r.url().includes("server") || r.url().includes("api") || r.method()==="POST") reqs.push(r.method()+" "+r.url()); });
page.on("response", async r => {
  if (r.url().includes("_server") || r.url().includes("listCommunities") || r.request().method()==="POST") {
    reqs.push("RESP "+r.status()+" "+r.url());
  }
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const body = await page.locator("body").innerText();
console.log("has Milstead Fellowship", body.includes("Milstead Fellowship"));
console.log("has Oakridge", body.includes("Oakridge"));
console.log("communities section", body.includes("Communities ready"));
console.log("reqs", reqs.slice(0,30));
await browser.close();
