import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = new URL('../server/.env', import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const products = JSON.parse(readFileSync(new URL('../server/catalog.json', import.meta.url), 'utf8'));
const knowledge = JSON.parse(readFileSync(new URL('../server/knowledge.json', import.meta.url), 'utf8'));
const uploadImages = process.argv.includes('--upload-images');

// Preflight the migration before attempting any writes. Existing rows are preserved.
const existing = await client.from('quicksub_products').select('id');
if (existing.error) throw new Error('Run the product catalog SQL migration first, then check your Supabase credentials.');
const known = new Set(existing.data.map(p => p.id));
let inserted = 0;
for (const [index, p] of products.entries()) {
  if (known.has(p.id)) continue;
  let imageUrl = p.bannerImage;
  if (uploadImages) {
    const image = new URL(imageUrl);
    // Import only the existing catalog's trusted image host, never arbitrary network URLs.
    if (image.protocol !== 'https:' || image.hostname !== 'images.pexels.com') throw new Error(`Unsupported image source for ${p.name}. Use an HTTPS Pexels URL or import the image manually.`);
    const response = await fetch(image, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    const mime = response.headers.get('content-type')?.split(';')[0];
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    if (!response.ok || !ext) throw new Error(`Image download failed for ${p.name}.`);
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 6291456) { await reader.cancel(); throw new Error(`Image too large: ${p.name}`); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const objectPath = `catalog/${p.id}-${hash}.${ext}`;
    const uploaded = await client.storage.from('quicksub-products').upload(objectPath, bytes, { contentType: mime, cacheControl: '31536000', upsert: false });
    if (uploaded.error && !['409','400'].includes(String(uploaded.error.statusCode))) throw new Error(`Image upload failed for ${p.name}. Check the bucket and credentials.`);
    if (uploaded.error) {
      const check = await client.storage.from('quicksub-products').download(objectPath);
      if (check.error) throw new Error(`Image upload could not be verified for ${p.name}.`);
    }
    imageUrl = client.storage.from('quicksub-products').getPublicUrl(objectPath).data.publicUrl;
  }
  const price = Number(p.startingPrice.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid price: ${p.name}`);
  const result = await client.from('quicksub_products').upsert({ id: p.id, price_bdt: price, image_url: imageUrl,
    in_stock: !p.outOfStock, active: true, sort_order: index, data: p }, { onConflict: 'id', ignoreDuplicates: true });
  if (result.error) throw new Error(`Could not save ${p.name}. Check the migration and credentials.`);
  inserted++;
}
const result = await client.from('quicksub_content').upsert({ id: 'store', data: { faq: knowledge.faq, policies: knowledge.policies, operations: knowledge.operations } }, { onConflict: 'id', ignoreDuplicates: true });
if (result.error) throw new Error('Could not save store policies. Check the quicksub_content table.');
console.log(`Catalog import complete: ${inserted} new products; ${known.size} existing rows preserved. Images ${uploadImages ? 'copied to Storage for new products' : 'saved as current URLs'}.`);
