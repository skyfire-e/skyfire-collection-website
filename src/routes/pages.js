const { Router } = require('express');
const path = require('path');
const { ROOT, STATIC_ROUTES } = require('../helpers');
const db = require('../db');

const router = Router();

const PUB = path.join(ROOT, 'public');

router.get('/health', (req, res) => {
  try {
    db.db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime(), db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'unavailable', error: 'Database unavailable' });
  }
});

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap(baseUrl) {
  const cats = db.getCategories();
  const loc = (path) => baseUrl + path;
  // /spreadsheet is intentionally absent: robots.txt disallows it
  const entries = [
    { loc: loc('/'), priority: '1.0' },
    { loc: loc('/gallery'), priority: '0.6' }
  ];
  for (const [id, section] of Object.entries(cats)) {
    entries.push({ loc: loc('/' + id), priority: '0.8' });
    for (const cat of (section.subcategories || [])) {
      if (cat.type === 'group' && cat.subcategories) {
        entries.push({ loc: loc('/' + id + '/' + cat.id), priority: '0.7' });
        for (const sc of cat.subcategories) {
          entries.push({ loc: loc('/gallery?section=' + encodeURIComponent(id) + '&category=' + encodeURIComponent(sc.id)), priority: '0.6' });
        }
      } else {
        entries.push({ loc: loc('/gallery?section=' + encodeURIComponent(id) + '&category=' + encodeURIComponent(cat.id)), priority: '0.6' });
      }
    }
  }
  const urls = entries.map(e =>
    '  <url><loc>' + xmlEscape(e.loc) + '</loc><changefreq>weekly</changefreq><priority>' + e.priority + '</priority></url>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
}

function getBaseUrl(req) {
  return (process.env.SITE_URL || 'https://' + req.hostname).replace(/\/$/, '');
}

router.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send([
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /spreadsheet',
    'Allow: /',
    '',
    'Sitemap: ' + getBaseUrl(req) + '/sitemap.xml',
    ''
  ].join('\n'));
});

router.get('/sitemap.xml', (req, res) => {
  try {
    res.set('Content-Type', 'application/xml');
    res.send(generateSitemap(getBaseUrl(req)));
  } catch (err) {
    console.error('Sitemap generation failed:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

const pages = {
  '/': 'index.html',

  '/gallery': 'gallery.html',
  '/admin': 'admin.html',
  '/spreadsheet': 'spreadsheet.html'
};

router.get(Object.keys(pages), (req, res) => {
  res.sendFile(path.join(PUB, pages[req.path]));
});

// Group page for ANY section (e.g. /miniatures/skaven, /dice/metal-sets).
// The DB is the source of truth: existing sections can't collide with static
// pages (those routes match earlier), and unknown sections fall through to 404.
router.get('/:section/:groupId', (req, res, next) => {
  const cats = db.getCategories();
  const section = cats[req.params.section];
  if (!section) return next();
  const group = section.subcategories.find(c => c.id === req.params.groupId);
  if (!group || group.type !== 'group') return next();
  res.sendFile(path.join(PUB, 'group-page.html'));
});

router.get('/:section', (req, res, next) => {
  if (STATIC_ROUTES.includes(req.params.section)) return next();
  const cats = db.getCategories();
  if (!cats[req.params.section]) return next();
  // Если подкатегорий нет — всё равно рендерим страницу (пустой список)
  res.sendFile(path.join(PUB, 'section-page.html'));
});

router.get('*', (req, res) => {
  res.status(404).sendFile(path.join(PUB, '404.html'));
});

module.exports = router;
