const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const {
  readJSON, writeJSONAtomic, withDataLock,
  SETTINGS_FILE, ITEMS_FILE
} = require('../helpers');

const router = Router();

router.post('/backfill-defaults', requireSameOrigin, requireAdmin, (req, res, next) => {
  withDataLock(() => {
    const items = readJSON(ITEMS_FILE) || [];
    const settings = readJSON(SETTINGS_FILE) || {};
    const defaultImage = settings.defaultImage || '/images/default.svg';
    let updated = 0;
    items.forEach(item => {
      if (!item.image || item.image === '/images/default.svg') {
        item.image = defaultImage;
        updated++;
      }
    });
    writeJSONAtomic(ITEMS_FILE, items);
    return { updated, defaultImage };
  }).then(result => res.json(result))
    .catch(err => { console.error('Backfill failed:', err); res.status(500).json({ error: 'Backfill failed' }); });
});

router.post('/backfill-images', requireSameOrigin, requireAdmin, (req, res) => {
  withDataLock(() => {
    const items = readJSON(ITEMS_FILE) || [];
    let updated = 0;
    items.forEach(item => {
      if (item.image && (!item.images || item.images.length === 0)) {
        item.images = [item.image];
        updated++;
      }
    });
    writeJSONAtomic(ITEMS_FILE, items);
    return { updated };
  }).then(result => res.json(result))
    .catch(err => { console.error('Backfill images failed:', err); res.status(500).json({ error: 'Backfill images failed' }); });
});

router.post('/backfill-prices', requireSameOrigin, requireAdmin, (req, res) => {
  withDataLock(() => {
    const items = readJSON(ITEMS_FILE) || [];
    let updated = 0;
    items.forEach(item => {
      if (typeof item.price === 'string' && item.price !== '') {
        item.price = parseFloat(item.price) || 0;
        updated++;
      } else if (item.price === undefined || item.price === null) {
        item.price = 0;
        updated++;
      }
    });
    writeJSONAtomic(ITEMS_FILE, items);
    return { updated };
  }).then(result => res.json(result))
    .catch(err => { console.error('Backfill prices failed:', err); res.status(500).json({ error: 'Backfill prices failed' }); });
});

module.exports = router;
