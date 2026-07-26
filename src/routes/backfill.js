const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const { VersionConflictError } = require('../errors');
const db = require('../db');

const router = Router();

router.post('/backfill-defaults', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    const items = db.allItems();
    const settings = db.getSettings();
    const defaultImage = settings.defaultImage || '/images/default.svg';
    let updated = 0;

    const tx = db.db.transaction(() => {
      for (const item of items) {
        if (!item.image || item.image === '/images/default.svg') {
          db.updateItem(item.id, { image: defaultImage, version: (item.version || 0) + 1 }, item.version);
          updated++;
        }
      }
      db.appendAudit({ action: 'backfill.defaults', updated });
    });
    tx();

    res.json({ updated, defaultImage });
  } catch (err) {
    if (err instanceof VersionConflictError) return res.status(409).json({ error: err.message });
    console.error('Backfill failed:', err);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

router.post('/backfill-images', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    const items = db.allItems();
    let updated = 0;

    const tx = db.db.transaction(() => {
      for (const item of items) {
        if (item.image && (!item.images || item.images.length === 0)) {
          db.updateItem(item.id, { images: [item.image], version: (item.version || 0) + 1 }, item.version);
          updated++;
        }
      }
      db.appendAudit({ action: 'backfill.images', updated });
    });
    tx();

    res.json({ updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return res.status(409).json({ error: err.message });
    console.error('Backfill images failed:', err);
    res.status(500).json({ error: 'Backfill images failed' });
  }
});

router.post('/backfill-prices', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    const items = db.allItems();
    let updated = 0;

    const tx = db.db.transaction(() => {
      for (const item of items) {
        if (typeof item.price === 'string' && item.price !== '') {
          db.updateItem(item.id, { price: parseFloat(item.price) || 0, version: (item.version || 0) + 1 }, item.version);
          updated++;
        }
      }
      db.appendAudit({ action: 'backfill.prices', updated });
    });
    tx();

    res.json({ updated });
  } catch (err) {
    if (err instanceof VersionConflictError) return res.status(409).json({ error: err.message });
    console.error('Backfill prices failed:', err);
    res.status(500).json({ error: 'Backfill prices failed' });
  }
});

router.get('/audit', requireAdmin, (req, res, next) => {
  try {
    const logs = db.getAuditLog(100);
    res.json(logs.map(l => ({ ...db.safeJsonParse(l.data, {}), id: l.id, timestamp: l.timestamp, action: l.action })));
  } catch (err) { next(err); }
});

module.exports = router;
