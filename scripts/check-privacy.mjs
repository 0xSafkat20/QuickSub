import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const testBase = "http://127.0.0.1:" + server.httpServer.address().port;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  for (const mode of ['normal', 'storage-denied', 'writes-denied', 'invalid-favorites', 'null-favorites', 'invalid-json', 'mixed-favorites']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) request.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Simulated offline API'})});
      else if (request.url().startsWith(testBase + '/') || request.url().startsWith('data:')) request.continue();
      else request.abort('blockedbyclient');
    });
    await page.evaluateOnNewDocument(mode => {
      if (mode === 'storage-denied') {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      } else if (mode === 'writes-denied') {
        Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); };
      } else if (mode === 'invalid-favorites') {
        localStorage.setItem('quicksub-favorites', '{"unexpected":true}');
      } else if (mode === 'null-favorites') {
        localStorage.setItem('quicksub-favorites', 'null');
      } else if (mode === 'invalid-json') {
        localStorage.setItem('quicksub-favorites', '{broken');
      } else if (mode === 'mixed-favorites') {
        localStorage.setItem('quicksub-favorites', '["1","1",null,42,{},"removed-product"]');
      }
    }, mode);
    await page.goto(testBase + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#products article', { timeout: 10000 });
    assert.equal(await page.$$eval('#products article', cards => cards.length), 21);
    await page.$eval('button[aria-label="Add to favorites"]', button => button.click());
    await page.waitForSelector('button[aria-label="Remove from favorites"]');
    assert.deepEqual(errors, [], `${mode}: browser errors`);
    console.log(`PASS ${mode}: catalog and wishlist work with external requests blocked`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
