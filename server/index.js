const express = require('express');
const cors = require('cors');
const { run, errorHandler } = require('./http');
const fs = require('fs');
const path = require('path');
const { createChatHandler } = require('./chat');
const { createCatalog } = require('./catalog');
const { createAdminRouter } = require('./admin');

const envPath = path.join(__dirname, '.env');
if (!process.env.VERCEL && fs.existsSync(envPath)) process.loadEnvFile(envPath);

const app = express();
app.disable('x-powered-by');
// Configure only the exact number of trusted reverse proxies in production.
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
// Same-origin requests need no CORS; grant cross-origin access only to the configured frontend.
app.use(cors({ origin: process.env.PUBLIC_ORIGIN || false }));

const cfgPath = path.join(__dirname, 'config.json');
let cfg = { phone: '', country: '', defaultMessage: '' };
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch (err) {
  console.error('Failed to read config.json:', err.message);
}

function buildWaNumber(phone, country) {
  if (!phone) return null;
  // If phone already starts with country (no leading 0), return as-is
  const clean = phone.replace(/[^0-9]/g, '');
  if (country && clean.startsWith(country)) return clean;
  // If phone starts with 0, drop it and prepend country
  if (clean.startsWith('0') && country) return country + clean.slice(1);
  // Fallback: just return cleaned
  return clean;
}

function buildWaLink(message) {
  const number = buildWaNumber(cfg.phone, cfg.country);
  if (!number) return null;
  const msg = message || cfg.defaultMessage || '';
  // wa.me requires number with country code and no plus or spaces
  return `https://wa.me/${number}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

// Returns JSON with the WhatsApp link
app.get('/api/contact', (req, res) => {
  const link = buildWaLink(typeof req.query.text === 'string' ? req.query.text : undefined);
  if (!link) return res.status(500).json({ error: 'No phone configured' });
  res.json({ whatsapp: link });
});

// WhatsApp remains a support action; purchase URLs open the in-site checkout.
app.get('/api/support/whatsapp', (req, res) => {
  const text = typeof req.query.text === 'string' ? req.query.text : undefined;
  const link = buildWaLink(text);
  if (!link) return res.status(500).send('No phone configured');
  res.redirect(link);
});

app.get(['/buy', '/api/buy'], (req, res) => {
  const params = new URLSearchParams();
  if (typeof req.query.product === 'string') params.set('product', req.query.product.slice(0,64));
  else if (typeof req.query.text === 'string') params.set('text', req.query.text.slice(0,1000));
  res.redirect(302, '/checkout' + (params.size ? '?' + params : ''));
});
app.get(['/cart', '/checkout', '/account', '/track', '/forgot-password', '/reset-password', '/subscriptions/*'], (_req, res) => res.set('Cache-Control','no-store').sendFile(path.join(__dirname, '../dist/index.html')));
app.use(express.json({ limit: '32kb' }));
const catalog = createCatalog({ localProducts: require('./catalog.json'), localKnowledge: require('./knowledge.json') });
app.get('/api/products', run(async (_req, res) => {
  const { products, source, stale } = await catalog.get();
  res.set('Cache-Control', 'no-store').json({ products, source, stale });
}));
app.post('/api/chat', createChatHandler({ knowledge: require('./knowledge.json'), getKnowledge: async () => {
  const snapshot = await catalog.get();
  return { ...snapshot.knowledge, freshness: snapshot.stale ? 'Database unavailable. Cached prices and availability may be outdated. Clearly state this and ask support to confirm before ordering.' : 'Current catalog snapshot (cached up to 60 seconds).' };
} }));

app.use('/api', createAdminRouter({ invalidate: catalog.invalidate }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.get(['/admin', '/admin/*'], (_req, res) => res.set('Cache-Control','no-store').sendFile(path.join(__dirname, '../dist/index.html')));
app.use('/assets', express.static(path.join(__dirname, '../dist/assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(path.join(__dirname, '../dist'), {
  setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); },
}));
app.use(errorHandler);

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`QuickSub listening on port ${port}`));
  if (!process.env.GEMINI_API_KEY) console.warn('AI key not configured; chat uses catalog/help fallback. See GEMINI-SUPABASE-SETUP.md.');
}
module.exports = app;
