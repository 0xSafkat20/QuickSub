import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { startTestServer } from "./admin-test-server.mjs";
const env = await startTestServer();
let browser;
try {
  browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const admin = await browser.newPage(),
    customer = await browser.newPage();
  const errors = [];
  for (const page of [admin, customer]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", async (r) => {
      if (
        r.status() >= 400 &&
        r.url().includes("/api/admin") &&
        !r.url().endsWith("/session")
      )
        console.log(r.status(), r.url(), await r.text());
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on("request", (r) =>
      r.url().startsWith(env.base) || r.url().startsWith("data:")
        ? r.continue()
        : r.abort("blockedbyclient"),
    );
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem("quicksub-cookie-consent", "accepted");
      } catch {}
    });
  }
  async function clickText(page, selector, text) {
    await page.waitForFunction(
      (s, t) =>
        [...document.querySelectorAll(s)].some(
          (e) => e.textContent.trim() === t,
        ),
      {},
      selector,
      text,
    );
    await page.evaluate(
      (s, t) =>
        [...document.querySelectorAll(s)]
          .find((e) => e.textContent.trim() === t)
          .click(),
      selector,
      text,
    );
  }
  await admin.bringToFront();
  await admin.goto(env.base + "/admin", { waitUntil: "networkidle0" });
  // Simulate cosmetic ad-block filters that previously hid the login controls.
  await admin.addStyleTag({ content: '[class^="ad-"], [class*=" ad-"] { display: none !important; }' });
  for (const selector of ['[name=email]', '[name=password]', 'button.qs-admin-primary']) {
    assert.equal(await admin.$eval(selector, el => el.getBoundingClientRect().height > 0), true);
  }
  await admin.type("[name=email]", "owner@example.test");
  await admin.type("[name=password]", "test-password");
  await clickText(admin, "button", "Sign in to dashboard");
  await admin.waitForSelector(".qs-admin-metrics");
  console.log("PASS login");
  await mkdir("deliverables/admin-preview", { recursive: true });
  await admin.screenshot({
    path: "deliverables/admin-preview/dashboard.png",
    fullPage: true,
    waitForFonts: false,
  });
  await clickText(admin, "nav button", "Products");
  await clickText(admin, "td button", "Edit");
  await admin.locator(".qs-admin-editor input").fill("Netflix Admin Connected");
  assert.equal(await admin.$eval(".qs-admin-editor input", e=>e.value), "Netflix Admin Connected");
  await clickText(admin, ".qs-admin-editor button", "Save product");
  await admin.waitForFunction(() => !document.querySelector(".qs-admin-editor"));
  await admin.waitForFunction(() =>
    document
      .querySelector("table")
      .textContent.includes("Netflix Admin Connected"),
  );
  console.log("PASS product edit");
  await customer.bringToFront();
  await customer.goto(env.base, { waitUntil: "networkidle0" });
  await customer.waitForFunction(() =>
    document
      .querySelector("#product-1")
      ?.textContent.includes("Netflix Admin Connected"),
  );
  await customer.$eval("#product-1", (el) =>
    [...el.querySelectorAll("button")]
      .find(
        (b) =>
          b.textContent.includes("Plans") ||
          b.textContent.includes("Order") ||
          b.textContent.includes("Buy"),
      )
      .click(),
  );
  await clickText(customer, "a", "Continue to checkout →");
  await customer.waitForSelector("form select");
  await customer.type("input[name=name]", "Browser Customer");
  await customer.type("input[name=contact]", "browser@example.test");
  await customer.type(
    "textarea[name=note]",
    "Please activate my subscription.",
  );
  console.log("PASS customer form");
  const created = customer.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await clickText(customer, "button", "Continue to payment · ৳299");
  const createdResponse = await created;
  assert.equal(createdResponse.status(), 201);
  const order = (await createdResponse.json()).order;
  await customer.waitForFunction(() =>
    document.body.textContent.includes("Private access code:"),
  );
  console.log("PASS order created");
  const code = await customer.evaluate(() =>
    [...document.querySelectorAll("p")]
      .find((p) => p.textContent.startsWith("Private access code:"))
      .textContent.split(":")[1]
      .trim(),
  );
  await customer.type(
    'input[placeholder="e.g. bKash — transaction reference"]',
    "TEST-REFERENCE-999",
  );
  await clickText(customer, "button", "Submit payment reference");
  await customer.waitForFunction(() =>
    document.body.textContent.includes("Payment: submitted"),
  );
  await admin.bringToFront();
  await clickText(admin, "nav button", "Orders");
  await clickText(admin, "button", "Refresh");
  await admin.waitForFunction(() =>
    document.querySelector("table")?.textContent.includes("Browser Customer"),
  );
  await clickText(admin, "td button", "Review");
  await admin.select(".qs-admin-editor select:nth-of-type(1)", "verified");
  const selects = await admin.$$(".qs-admin-editor select");
  await selects[1].select("delivered");
  await admin.type(".qs-admin-editor textarea", "Your subscription is activated.");
  await clickText(admin, ".qs-admin-editor button", "Save order update");
  await admin.waitForFunction(() => !document.querySelector(".qs-admin-editor"));
  await customer.bringToFront();
  await clickText(customer, "a", "Back to store");
  await clickText(customer, "button", "Track Order");
  const fields = await customer.$$("[role=dialog] input");
  await fields[0].type(order.id);
  await fields[1].type(code);
  await clickText(customer, "button", "Track order");
  await customer.waitForFunction(() =>
    document
      .querySelector("[role=dialog]")
      ?.textContent.includes("Your subscription is activated."),
  );
  await customer.screenshot({
    path: "deliverables/admin-preview/customer-tracking.png",
    fullPage: false,
    waitForFonts: false,
  });
  await admin.setViewport({ width: 390, height: 844 });
  await clickText(admin, "nav button", "Overview");
  await admin.screenshot({
    path: "deliverables/admin-preview/mobile.png",
    fullPage: true,
    waitForFonts: false,
  });
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await customer.setViewport({ width: 390, height: 844 });
  await customer.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert.equal(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: admin login, edit product, customer checkout, payment submission, admin fulfillment, private tracking, mobile layout, blocked external requests, no runtime errors.",
  );
} finally {
  if (browser) await browser.close();
  await env.close();
}
