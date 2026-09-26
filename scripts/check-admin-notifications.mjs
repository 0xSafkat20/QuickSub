import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { packageId, startTestServer } from './admin-test-server.mjs';

const env = await startTestServer();
let browser;
try {
  const headers = { Origin: env.base, 'Content-Type': 'application/json', 'X-QuickSub-Client': 'web' };
  await fetch(env.base + '/api/requests', {
    method: 'POST', headers,
    body: JSON.stringify({ kind: 'support', contact: 'badge-test@example.test', message: 'Notification badge test' }),
  });
  await fetch(env.base + '/api/orders', {
    method: 'POST', headers,
    body: JSON.stringify({ id: randomUUID(), accessCode: randomBytes(32).toString('hex'), packageId, name: 'Badge Test', contact: 'badge-test@example.test', note: '', expectedPrice: 299 }),
  });

  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    timeout: 120_000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(env.base + '/admin', { waitUntil: 'networkidle0' });
  await page.type('[name=email]', 'owner@example.test');
  await page.type('[name=password]', 'test-password');
  await page.click('button.qs-admin-primary');
  await page.waitForSelector('.qs-admin-notification-count');

  const notifications = await page.$$eval('nav button', buttons => Object.fromEntries(
    buttons.map(button => [button.textContent.trim().replace(/\d+\+?$/, ''), Number(button.querySelector('.qs-admin-notification-count')?.textContent || 0)]),
  ));
  assert.equal(notifications.Orders, 1);
  assert.equal(notifications.Inbox, 1);
  assert.ok(notifications.Packages > 0);
  const { Overview, ...sectionCounts } = notifications;
  assert.equal(Overview, Object.values(sectionCounts).reduce((sum, count) => sum + count, 0));
  assert.equal(await page.$eval('button[aria-label^="Orders,"]', button => button.getAttribute('aria-label')), 'Orders, 1 notifications');

  await mkdir('deliverables/admin-preview', { recursive: true });
  await page.$eval('.qs-admin-sidebar', element => element.scrollIntoView());
  const sidebar = await page.$('.qs-admin-sidebar');
  await sidebar.screenshot({ path: 'deliverables/admin-preview/notification-badges.png' });
  console.log('PASS admin sidebar shows accessible live counts for overview, packages, orders and inbox');
} finally {
  await browser?.close();
  await env.close();
}
