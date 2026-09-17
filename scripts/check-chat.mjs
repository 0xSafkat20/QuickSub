import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

// Integration tests are deliberately offline: no real provider key or paid calls.
process.env.GEMINI_API_KEY = '';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
const require = createRequire(import.meta.url);
const app = require('../server/index.js');
const catalogFixture = require('../server/catalog.json').map(p => p.id === '1' ? { ...p, name: 'Netflix Database Test', startingPrice: 'Starting from ৳777' } : p);
const backend = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
const testBase = 'http://127.0.0.1:' + backend.address().port;
let browser;
try {
  const real = await fetch(testBase + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Netflix Premium' }),
  });
  assert.equal(real.status, 200);
  assert.match((await real.json()).reply, /299/);
  const invalid = await fetch(testBase + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  const large = await fetch(testBase + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(17000) }) });
  assert.equal(large.status, 413);
  const redirect = await fetch(testBase + '/buy?text=' + encodeURIComponent('Help & pricing বাংলা'), { redirect: 'manual' });
  assert.equal(new URL(redirect.headers.get('location')).searchParams.get('text'), 'Help & pricing বাংলা');
  console.log('PASS real HTTP routing, offline fallback, malformed/oversized requests and WhatsApp encoding');

  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('quicksub-cookie-consent', 'accepted'));
  const errors = [];
  const requests = [];
  let status = 200;
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (new URL(request.url()).pathname === '/api/products') {
      await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: catalogFixture, source: 'supabase', stale: false }) });
    } else if (new URL(request.url()).pathname === '/api/chat') {
      requests.push(JSON.parse(request.postData()));
      await new Promise(resolve => setTimeout(resolve, 150));
      await request.respond({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? {
        reply: requests.length === 1 ? 'What is your budget and main study goal?' : 'আপনার জন্য ChatGPT বিবেচনা করতে পারেন। শুরু ৳499; প্যাকেজ সাপোর্ট নিশ্চিত করবে।',
        sessionId: '11111111-1111-4111-8111-111111111111',
        ...(requests.length > 1 ? { url: '/buy?text=ChatGPT' } : {}),
      } : { error: 'Unavailable' }) });
    } else if (request.url().startsWith(testBase + '/') || request.url().startsWith('data:')) await request.continue();
    else await request.abort('blockedbyclient');
  });
  await page.goto(testBase + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[aria-label="Open chat"]');
  await page.waitForFunction(() => document.querySelector('#product-1')?.textContent.includes('Netflix Database Test') && document.querySelector('#product-1')?.textContent.includes('777'));
  await page.click('[aria-label="Open chat"]');
  await page.type('[aria-label="Message QuickSub support"]', 'I need study help');
  await page.click('[aria-label="Send message"]');
  await page.waitForFunction(() => document.querySelector('[role="log"]').textContent.includes('main study goal'));
  await page.type('[aria-label="Message QuickSub support"]', 'My budget is 500');
  await page.click('[aria-label="Send message"]');
  await page.waitForSelector('[role="log"] a[href="/buy?text=ChatGPT"]');
  assert.equal(requests[1].sessionId, '11111111-1111-4111-8111-111111111111');
  assert.equal(requests[0].message, 'I need study help');
  assert.equal('messages' in requests[1], false);
  status = 429;
  await page.type('[aria-label="Message QuickSub support"]', 'More help');
  await page.click('[aria-label="Send message"]');
  await page.waitForFunction(() => document.querySelector('[role="log"]').textContent.includes('wait a minute'));
  status = 503;
  await page.type('[aria-label="Message QuickSub support"]', 'Try again');
  await page.click('[aria-label="Send message"]');
  await page.waitForFunction(() => document.querySelector('[role="log"]').textContent.includes('temporarily unavailable'));
  assert.equal(await page.$$eval('#products article', cards => cards.length), 21);
  assert.deepEqual(errors, []);
  console.log('PASS existing chat UI: multi-turn replies, Bangla, safe handoff, rate limits, outage recovery and intact catalog');
} finally {
  await browser?.close();
  await new Promise(resolve => backend.close(resolve));
}
