import { startTestServer } from './admin-test-server.mjs';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 4000);
const env = await startTestServer({ port, receiptSimulation: true });
const packages = JSON.parse(await readFile(new URL('../server/packages.json', import.meta.url), 'utf8'));
await env.db.query('delete from quicksub_packages');
for (const item of packages) {
  await env.db.query(
    'insert into quicksub_packages(id,product_id,name,details,price_bdt,active) values($1,$2,$3,$4,$5,$6)',
    [item.id, item.product_id, item.name, item.details, item.price_bdt, item.active],
  );
}
console.log(`QuickSub local API simulation listening on http://127.0.0.1:${port}.`);
console.log('Accounts, carts, orders, subscriptions, and payments are local and are discarded when this process stops.');
for (const event of ['SIGINT', 'SIGTERM']) {
  process.on(event, async () => {
    await env.close();
    process.exit(0);
  });
}
