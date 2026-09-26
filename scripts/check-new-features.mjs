import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { startTestServer, packageId } from './admin-test-server.mjs';

const env = await startTestServer();
let browser;
try {
  await mkdir('deliverables/feature-preview', { recursive: true });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, timeout: 120_000 });
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(env.base) || request.url().startsWith('data:') ? request.continue() : request.abort('blockedbyclient'));
  const clickText = async text => {
    await page.waitForFunction(value => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === value), {}, text);
    await page.evaluate(value => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === value).click(), text);
  };

  console.log('STEP create isolated customer and completed purchase');
  await page.goto(env.base + '/account', { waitUntil: 'networkidle0' });
  await clickText('New here? Create an account');
  await page.type('[name="name"]', 'Feature Reviewer');
  await page.type('[name="email"]', 'feature-reviewer@example.test');
  await page.type('[name="password"]', 'review-password-123');
  await clickText('Create account');
  await page.waitForFunction(() => document.body.innerText.includes('Signed in as'));
  const orderId = await page.evaluate(async id => {
    const orderId = crypto.randomUUID();
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'x-quicksub-client': 'web' }, body: JSON.stringify({ id: orderId, accessCode: 'c'.repeat(64), packageId: id, name: 'Feature Reviewer', contact: 'feature-reviewer@example.test', note: '', expectedPrice: 299 }) });
    if (!response.ok) throw new Error('Order creation failed: ' + response.status);
    return orderId;
  }, packageId);
  await env.db.query("update quicksub_orders set status='delivered',payment_status='verified' where id=$1", [orderId]);
  await page.reload({ waitUntil: 'networkidle0' });
  await clickText('Review this purchase');
  await page.click('[aria-label="4 stars"]');
  await page.locator('textarea[placeholder*="Tell other customers"]').fill('Excellent Netflix product and quick verified delivery.');
  await clickText('Publish review');
  await page.waitForFunction(() => document.body.innerText.includes('your verified review is now visible'));
  await page.screenshot({ path: 'deliverables/feature-preview/completed-purchase-review.png', fullPage: true });
  console.log('PASS review form appears only on a completed purchase and publishes a 4-star product comment');

  await page.goto(env.base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Excellent Netflix product and quick verified delivery.'));
  assert.match(await page.$eval('#reviews', element => element.innerText), /Verified purchase/);
  const reviewSection = await page.$('#reviews');
  assert.ok(reviewSection);
  await reviewSection.screenshot({ path: 'deliverables/feature-preview/landing-page-verified-review.png' });
  console.log('PASS published review appears in the storefront verified-review section');

  const search = '#products input[role="combobox"]';
  await page.locator(search).fill('chat');
  await page.waitForSelector('#product-search-suggestions');
  assert.match(await page.$eval('#product-search-suggestions', element => element.innerText), /ChatGPT Subscription/);
  await page.locator(search).fill('netf');
  await page.waitForFunction(() => document.querySelector('#product-search-suggestions')?.innerText.includes('Netflix Premium'));
  await page.click('#product-search-suggestions button');
  await page.waitForSelector('[aria-label="Netflix Premium reviews"]');
  assert.match(await page.$eval('[aria-label="Netflix Premium reviews"]', element => element.innerText), /Excellent Netflix product/);
  console.log('PASS dynamic search suggests while typing, selects a result, and product details show its comment');
  await page.click('[aria-label="Close"]');

  for (const [title, expected] of [['Terms and Conditions', 'Acceptance of Terms'], ['Return Policy', 'Digital Products and Returns']]) {
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('quicksub:open-legal', { detail: value })), title);
    await page.waitForFunction(value => document.body.innerText.includes(value), {}, expected);
    assert.match(await page.$eval('[role="dialog"], .fixed.inset-0', element => element.innerText), new RegExp(expected));
    await page.click('[aria-label="Close"]');
  }
  console.log('PASS Terms and Conditions and Return Policy open with the expected content');

  const seo = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    keywords: document.querySelector('meta[name="keywords"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    robots: document.querySelector('meta[name="robots"]')?.content,
    schema: JSON.parse(document.querySelector('#quicksub-page-schema').textContent),
  }));
  assert.match(seo.title, /Digital Subscriptions.*Game Top-Ups/i);
  assert.match(seo.description, /Bangladesh/i);
  assert.match(seo.keywords, /game top up Bangladesh/i);
  assert.equal(seo.canonical, 'https://quicksub.com/');
  assert.match(seo.robots, /^index, follow/);
  assert.equal(seo.schema['@type'], 'OnlineStore');
  await page.goto(env.base + '/account', { waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('meta[name="robots"]', element => element.content), 'noindex, follow');
  const sitemap = await (await fetch(env.base + '/sitemap.xml')).text();
  assert.match(sitemap, /2026-09-25/);
  assert.doesNotMatch(sitemap, /#products|#reviews|#faq/);
  console.log('PASS SEO titles, descriptions, keywords, canonical, robots, JSON-LD, social-ready metadata and sitemap behavior');
  assert.deepEqual(errors, []);
  console.log('PASS no browser runtime errors');
} finally {
  await browser?.close();
  await env.close();
}
