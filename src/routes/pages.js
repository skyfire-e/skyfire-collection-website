const { Router } = require('express');
const path = require('path');
const { ROOT } = require('../helpers');
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
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = db.getCategories();
  if (cats[req.params.section]) {
    return res.sendFile(path.join(PUB, 'miniatures-subgroup.html'));
  }
  next();
});

router.get('/:section', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = db.getCategories();
  if (cats[req.params.section]) {
    return res.sendFile(path.join(PUB, 'section-page.html'));
  }
  next();
});

router.get('*', (req, res) => {
  res.status(404).sendFile(path.join(PUB, '404.html'));
});

module.exports = router;
