const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

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
  return `https://wa.me/${number}${msg ? `?text=${msg}` : ''}`;
}

// Returns JSON with the WhatsApp link
app.get('/api/contact', (req, res) => {
  const link = buildWaLink(req.query.text);
  if (!link) return res.status(500).json({ error: 'No phone configured' });
  res.json({ whatsapp: link });
});

// Redirects to WhatsApp directly (useful when frontend can open /buy)
app.get(['/buy', '/api/buy'], (req, res) => {
  const text = req.query.text ? encodeURIComponent(req.query.text) : undefined;
  const link = buildWaLink(text);
  if (!link) return res.status(500).send('No phone configured');
  res.redirect(link);
});

app.use(express.json());

app.post('/api/notify', (req, res) => {
  const { productId, productName } = req.body || {};
  if (!productId || !productName) {
    return res.status(400).json({ error: 'Product information required' });
  }

  const logDir = path.join(__dirname, 'logs');
  const logFile = path.join(logDir, 'notifications.json');
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      productId,
      productName,
      source: 'stock-alert',
    };
    const existing = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
    existing.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(existing, null, 2), 'utf8');
    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to log notification request:', err.message);
    return res.status(500).json({ error: 'Failed to save notification request' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`QuickSub backend listening on port ${port}`);
});
