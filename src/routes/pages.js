const { Router } = require('express');
const path = require('path');
const { readJSON, CATEGORIES_FILE, ROOT } = require('../helpers');

const router = Router();

const PUB = path.join(ROOT, 'public');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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

// Dynamic subgroup page for any section group
router.get('/:section/:groupId', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(PUB, 'miniatures-subgroup.html'));
  }
  next();
});

// Dynamic section page for any top-level category
router.get('/:section', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(PUB, 'section-page.html'));
  }
  next();
});

router.get('*', (req, res) => {
  res.status(404).sendFile(path.join(PUB, '404.html'));
});

module.exports = router;
