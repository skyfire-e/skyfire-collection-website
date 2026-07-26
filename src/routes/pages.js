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

function generateSitemap(baseUrl) {
  const cats = db.getCategories();
  const loc = (path) => baseUrl + path;
  const entries = [
    { loc: loc('/'), priority: '1.0' },
    { loc: loc('/gallery'), priority: '0.6' },
    { loc: loc('/spreadsheet'), priority: '0.5' }
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
    '  <url><loc>' + e.loc + '</loc><changefreq>weekly</changefreq><priority>' + e.priority + '</priority></url>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
}

router.get('/sitemap.xml', (req, res) => {
  try {
    const baseUrl = process.env.SITE_URL || 'https://' + req.hostname;
    res.set('Content-Type', 'application/xml');
    res.send(generateSitemap(baseUrl.replace(/\/$/, '')));
  } catch (err) {
    console.error('Sitemap generation failed:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

const pages = {
  '/': 'index.html',
  '/dice': 'dice.html',
  '/miniatures': 'miniatures.html',
  '/gallery': 'gallery.html',
  '/admin': 'admin.html',
  '/spreadsheet': 'spreadsheet.html'
};

router.get(Object.keys(pages), (req, res) => {
  const page = pages[req.path];
  if (page) res.sendFile(path.join(PUB, page));
});

router.get('/miniatures/:group', (req, res) => {
  res.sendFile(path.join(PUB, 'miniatures-subgroup.html'));
});

router.get('/:section/:groupId', (req, res, next) => {
  if (STATIC_ROUTES.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = db.getCategories();
  if (!cats[req.params.section]) return next();
  const group = cats[req.params.section].subcategories.find(c => c.id === req.params.groupId);
  if (!group || group.type !== 'group') return next();
  res.sendFile(path.join(PUB, 'miniatures-subgroup.html'));
});

router.get('/:section', (req, res, next) => {
  if (STATIC_ROUTES.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = db.getCategories();
  if (!cats[req.params.section]) return next();
  // Если подкатегорий нет — всё равно рендерим страницу (пустой список)
  res.sendFile(path.join(PUB, 'section-page.html'));
});

router.get('*', (req, res) => {
  res.status(404).sendFile(path.join(PUB, '404.html'));
});

module.exports = router;
