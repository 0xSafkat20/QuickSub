const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalog, toProduct } = require('./catalog');
const localProducts = require('./catalog.json');
const localKnowledge = require('./knowledge.json');
const row = { id: '1', price_bdt: '399.50', image_url: 'https://example.com/netflix.jpg', in_stock: false, data: localProducts[0] };

test('database price, image and availability override bundled values', () => {
  const p = toProduct(row);
  assert.equal(p.startingPrice, 'Starting from ৳399.5');
  assert.equal(p.bannerImage, row.image_url);
  assert.equal(p.outOfStock, true);
});
test('rejects malformed catalog records and unsafe image URLs', () => {
  for (const broken of [{ ...row, price_bdt: -1 }, { ...row, image_url: 'javascript:alert(1)' }, { ...row, data: {} }, { ...row, data: { ...row.data, badges: null } }]) assert.throws(() => toProduct(broken));
});
test('caches one shared database snapshot for the website and chatbot', async () => {
  let calls = 0;
  let time = 0;
  const catalog = createCatalog({ localProducts, localKnowledge, url: 'https://project.supabase.co', key: 'private-test', now: () => time,
    fetchImpl: async (url, { headers }) => {
      calls++;
      assert.equal(headers.apikey, 'private-test');
      return { ok: true, json: async () => url.includes('quicksub_products') ? [row] : [{ data: localKnowledge }] };
    } });
  const [first, second] = await Promise.all([catalog.get(), catalog.get()]);
  assert.equal(first, second);
  assert.equal(calls, 3);
  assert.equal(first.knowledge.products[0].startingPrice, first.products[0].startingPrice);
  await catalog.get();
  assert.equal(calls, 3);
  time = 60001;
  await catalog.get();
  assert.equal(calls, 6);
});
test('outages preserve the last good data and identify it as stale', async () => {
  let failed = false;
  let time = 0;
  const catalog = createCatalog({ localProducts, localKnowledge, url: 'https://project.supabase.co', key: 'test', now: () => time,
    fetchImpl: async url => { if (failed) throw new Error('offline'); return { ok: true, json: async () => url.includes('quicksub_products') ? [row] : [{ data: localKnowledge }] }; } });
  await catalog.get(); failed = true; time = 60001;
  const result = await catalog.get();
  assert.equal(result.stale, true);
  assert.equal(result.products[0].startingPrice, 'Starting from ৳399.5');
});
test('an intentionally empty initialized database stays empty', async () => {
  const catalog = createCatalog({ localProducts, localKnowledge, url: 'https://project.supabase.co', key: 'test',
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('quicksub_products') ? [] : [{ data: localKnowledge }] }) });
  assert.equal((await catalog.get()).products.length, 0);
});
test('no credentials uses the local catalog without network calls', async () => {
  const catalog = createCatalog({ localProducts, localKnowledge, url: '', key: '', fetchImpl: async () => { throw new Error('Must not fetch'); } });
  assert.equal((await catalog.get()).source, 'local');
});
