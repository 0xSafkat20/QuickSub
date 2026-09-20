import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { randomUUID } from "node:crypto";
import { startTestServer, packageId } from "./admin-test-server.mjs";

const env=await startTestServer({now:()=>Date.parse("2026-09-21T12:00:00Z")});let browser;
try {
 const order=randomUUID();
 await env.db.query("insert into quicksub_orders(id,tracking_hash,package_id,product_name,package_name,amount_bdt,customer_name,contact,status,payment_status,created_at,updated_at,expires_at,paid_at) values($1,'report',$2,'Netflix','Premium',299,'Report Customer','report@example.test','delivered','verified','2026-09-10','2026-09-10','2026-09-30','2026-09-10')",[order,packageId]);
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
 const page=await browser.newPage(),errors=[];let failNext=false;page.on("pageerror",e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on("request",r=>{if(failNext&&r.url().includes("/api/admin/reports?")){failNext=false;return r.respond({status:503,contentType:"application/json",body:JSON.stringify({error:"Reporting is temporarily unavailable."})});}return r.url().startsWith(env.base)||r.url().startsWith("data:")?r.continue():r.abort();});
 await page.setViewport({width:320,height:740});await page.goto(env.base+"/admin",{waitUntil:"networkidle0"});
 await page.type("[name=email]","owner@example.test");await page.type("[name=password]","test-password");await page.click("button.qs-admin-primary");await page.waitForSelector(".qs-admin-metrics");
 await page.evaluate(()=>[...document.querySelectorAll("nav button")].find(e=>e.textContent.trim()==="Reports").click());
 await page.waitForSelector(".qs-report-metrics");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.$eval(".qs-report-metrics",el=>el.textContent.includes("৳299")),true);
 await page.evaluate(()=>[...document.querySelectorAll(".qs-report-presets button")].find(e=>e.textContent.trim()==="Next 60 days").click());
 await page.waitForFunction(()=>document.querySelector(".qs-report-section:last-of-type")?.textContent.includes("Report Customer"));
 assert.equal(await page.$eval(".qs-report-section:last-of-type",el=>el.textContent.includes("report@example.test")),true);
 // A failed refresh keeps the last useful report visible and offers a retry.
 failNext=true;
 await page.click(".qs-report-date-grid button");await page.waitForFunction(()=>document.querySelector("[role=alert]")?.textContent.includes("temporarily unavailable"));
 assert.ok(await page.$(".qs-report-metrics"));
 await page.setViewport({width:1440,height:900});await page.reload({waitUntil:"networkidle0"});await page.waitForSelector(".qs-admin-metrics");
 await page.evaluate(()=>[...document.querySelectorAll("nav button")].find(e=>e.textContent.trim()==="Reports").click());await page.waitForSelector(".qs-report-metrics");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log("PASS: reporting totals, presets, expiry contacts, recoverable errors, and responsive 320px/1440px layouts.");
} finally {await browser?.close();await env.close();}
