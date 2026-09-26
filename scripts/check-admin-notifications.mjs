import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { packageId, startTestServer } from './admin-test-server.mjs';

const env = await startTestServer();
let browser;
try {
  const headers = { Origin: env.base, 'Content-Type': 'application/json', 'X-QuickSub-Client': 'web' };
  const createRequest = (message) => fetch(env.base + '/api/requests', {
    method: 'POST', headers,
    body: JSON.stringify({ kind: 'support', contact: 'badge-test@example.test', message }),
  });
  await createRequest('Notification badge test');
  await fetch(env.base + '/api/orders', {
    method: 'POST', headers,
    body: JSON.stringify({ id: randomUUID(), accessCode: randomBytes(32).toString('hex'), packageId, name: 'Badge Test', contact: 'badge-test@example.test', note: '', expectedPrice: 299 }),
  });
  await env.db.query(
    `insert into quicksub_orders(
      id,tracking_hash,package_id,product_name,package_name,amount_bdt,
      customer_name,contact,customer_note,is_demo
    ) values(
      'd0000000-0000-4000-8000-000000000099',repeat('d',64),$1,
      'Demo Product','Demo Package',299,'[DEMO] Customer',
      'demo@example.test','',true
    )`,
    [packageId],
  );

  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    timeout: 120_000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(env.base + '/admin', { waitUntil: 'networkidle0' });
  await page.type('[name=email]', 'owner@example.test');
  await page.type('[name=password]', 'test-password');
  await page.click('button.qs-admin-primary');
  await page.waitForSelector('.qs-admin-notification-count');

  const adminData = await page.evaluate(() => fetch('/api/admin/data').then(response => response.json()));
  assert.equal(adminData.orders.some(order => order.customer_name.startsWith('[DEMO]')), false);
  assert.equal(adminData.customers.some(customer => customer.name.startsWith('[DEMO]')), false);
  assert.equal(adminData.overview.pending, 1);
  assert.equal(adminData.notifications.Orders, 1);

  const getNotifications = () => page.$$eval(
    '#qs-admin-navigation button:not(.qs-admin-nav-toggle)',
    buttons => Object.fromEntries(buttons.map(button => [
      button.textContent.trim().replace(/\d+\+?$/, ''),
      Number(button.querySelector('.qs-admin-notification-count')?.textContent || 0),
    ])),
  );
  const notifications = await getNotifications();
  assert.equal(notifications.Orders, 1);
  assert.equal(notifications.Inbox, 1);
  assert.ok(notifications.Packages > 0);
  const { Overview, ...sectionCounts } = notifications;
  assert.equal(Overview, Object.values(sectionCounts).reduce((sum, count) => sum + count, 0));
  assert.equal(await page.$eval('button[aria-label^="Orders,"]', button => button.getAttribute('aria-label')), 'Orders, 1 notifications');

  await page.click('button[aria-label^="Orders,"]');
  await page.waitForFunction(() => document.querySelector('button[aria-label="Orders"]'));
  assert.equal((await getNotifications()).Orders, 0);
  assert.equal((await getNotifications()).Inbox, 1);

  await page.click('.qs-admin-mark-read');
  await page.waitForFunction(() => !document.querySelector('.qs-admin-notification-count'));
  assert.equal(await page.$('.qs-admin-mark-read'), null);

  await createRequest('A newly arrived notification');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Inbox, 1 notifications"]');
  const newNotifications = await getNotifications();
  assert.equal(newNotifications.Inbox, 1);
  assert.equal(newNotifications.Overview, 1);

  await page.setViewport({ width: 683, height: 742 });
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  ));
  const mobileNavigation = await page.$eval('.qs-admin-sidebar nav', nav => ({
    fits: nav.scrollWidth <= nav.clientWidth,
    columns: new Set(
      [...nav.querySelectorAll('button')].map(button =>
        Math.round(button.getBoundingClientRect().left),
      ),
    ).size,
  }));
  assert.equal(mobileNavigation.fits, true);
  assert.ok(mobileNavigation.columns >= 2);
  const visibleSections = () => page.$$eval(
    '#qs-admin-navigation button:not(.qs-admin-nav-toggle)',
    buttons => buttons.filter(button => button.getClientRects().length > 0).length,
  );
  assert.equal(await visibleSections(), 6);
  assert.equal(await page.$eval('.qs-admin-nav-toggle', button => button.textContent.trim()), 'Show more');
  await page.click('.qs-admin-nav-toggle');
  assert.equal(await visibleSections(), 12);
  assert.equal(await page.$eval('.qs-admin-nav-toggle', button => button.getAttribute('aria-expanded')), 'true');
  await page.click('.qs-admin-nav-toggle');
  assert.equal(await visibleSections(), 6);

  await mkdir('deliverables/admin-preview', { recursive: true });
  await page.$eval('.qs-admin-sidebar', element => element.scrollIntoView());
  const sidebar = await page.$('.qs-admin-sidebar');
  await sidebar.screenshot({ path: 'deliverables/admin-preview/notification-badges.png' });
  console.log('PASS live notification counts, read lifecycle, new unread detection, demo filtering, and mobile navigation');
} finally {
  await browser?.close();
  await env.close();
}
