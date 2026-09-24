import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(readFileSync(new URL('../server/catalog.json', import.meta.url), 'utf8'));
const packages = JSON.parse(readFileSync(new URL('../server/packages.json', import.meta.url), 'utf8'));
const productMigration = readFileSync(new URL('../supabase/migrations/20260927500000_default_products.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260928000000_default_packages.sql', import.meta.url), 'utf8');

test('every catalog product has one valid default checkout package', () => {
  assert.equal(packages.length, catalog.length);
  const productIds = new Set(catalog.map((product) => product.id));
  assert.deepEqual(new Set(packages.map((item) => item.product_id)), productIds);
  assert.equal(new Set(packages.map((item) => item.id)).size, packages.length);

  for (const item of packages) {
    const product = catalog.find((entry) => entry.id === item.product_id);
    assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(item.active, true);
    assert.equal(item.name, product.popularPlan);
    assert.equal(item.price_bdt, Number(product.startingPrice.replace(/[^\d.]/g, '')));
    assert.ok(item.details.length > 20);
    if (product.category === 'gaming') assert.match(item.details, /account|player/i);
    else assert.match(item.name, /1 month/i);
  }
});

test('product migration contains the complete catalog and preserves admin edits on rerun', () => {
  assert.match(productMigration, /on conflict\(id\) do nothing/i);
  for (const product of catalog) assert.match(productMigration, new RegExp(`'${product.id}'`));
});

test('database migration contains every package and preserves admin edits on rerun', () => {
  assert.match(migration, /on conflict\(id\) do nothing/i);
  for (const item of packages) assert.match(migration, new RegExp(item.id));
});