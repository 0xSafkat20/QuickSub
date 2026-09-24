import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { startTestServer, packageId } from './admin-test-server.mjs';
let clock = Date.now();
const env = await startTestServer({ now: () => clock });
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(env.base) || request.url().startsWith('data:') ? request.continue() : request.abort());
  const click = async text => {
    await page.waitForFunction(text => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === text), {}, text);
    await page.evaluate(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text).click(), text);
  };
  await page.goto(env.base + '/account', { waitUntil: 'networkidle0' });
  await click('New here? Create an account');
  await page.type('[name="name"]', 'Session Tester');
  await page.type('[name="email"]', 'session-browser@example.test');
  await page.type('[name="password"]', 'test-password-123');
  await click('Create account');
  await page.waitForFunction(() => document.body.innerText.includes('Signed in as'));
  const created = await page.evaluate(async packageId => {
    const id = crypto.randomUUID();
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'x-quicksub-client': 'web' },
      body: JSON.stringify({ id, accessCode: 'c'.repeat(64), packageId, name: 'Session Tester', contact: 'session-browser@example.test', note: '', expectedPrice: 299 }) });
    return { status: response.status, id };
  }, packageId);
  assert.equal(created.status, 201);
  await page.goto(env.base + '/checkout?product=1', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[name="name"]');
  await page.type('[name="name"]', 'Draft Customer');
  await page.type('[name="contact"]', 'draft@example.test');
  await page.type('[name="note"]', 'Keep my checkout after logout');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[name="name"]');
  assert.equal(await page.$eval('[name="name"]', element => element.value), 'Draft Customer');
  await page.goto(env.base + '/account', { waitUntil: 'networkidle0' });
  await page.waitForFunction(id => document.body.innerText.includes(id), {}, created.id);
  clock += 7200000;
  // Advance the browser clock too; focus simulates returning to a sleeping tab.
  await page.evaluate(now => { Date.now = () => now; window.dispatchEvent(new Event('focus')); }, clock + 1);
  await page.waitForFunction(() => document.body.innerText.includes('Welcome back') && !document.body.innerText.includes('Signed in as'));
  assert.equal(await page.evaluate(async () => (await fetch('/api/account/orders')).status), 401);
  await page.type('[name="email"]', 'session-browser@example.test');
  await page.type('[name="password"]', 'test-password-123');
  await click('Sign in');
  await page.waitForFunction(id => document.body.innerText.includes('Signed in as') && document.body.innerText.includes(id), {}, created.id);
  await page.goto(env.base + '/checkout?product=1', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[name="name"]');
  assert.equal(await page.$eval('[name="name"]', element => element.value), 'Draft Customer');
  assert.equal(await page.$eval('[name="contact"]', element => element.value), 'draft@example.test');
  assert.equal(await page.$eval('[name="note"]', element => element.value), 'Keep my checkout after logout');
  assert.equal(await page.$eval('[name="packageId"]', element => element.value), packageId);
  await page.goto(env.base + '/account', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Signed in as'));
  // A short UI-only deadline checks the idle timer without any further API request or click.
  await page.evaluate(() => {
    localStorage.setItem('quicksub-session-expiry-customer', new Date(Date.now() + 500).toISOString());
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(() => document.body.innerText.includes('Welcome back'));
  assert.deepEqual(errors, []);
  console.log('PASS: automatic two-hour logout, server rejection, re-login with previous order, and checkout draft/package restored after reload.');
} finally { await browser?.close(); await env.close(); }
