const { Router } = require('express');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  safeUnlink, cleanupUploadedFiles, normalizeImage,
} = require('../helpers');
const db = require('../db');

const router = Router();

router.post('/default', requireSameOrigin, requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const imagePath = await normalizeImage(req.file);
    const settings = db.getSettings();
    const oldDefault = settings.defaultImage;
    db.updateSettings({ defaultImage: imagePath });
    if (oldDefault && oldDefault !== imagePath) {
      const items = db.allItems();
      const stillReferenced = items.some(i => i.image === oldDefault || i.images?.includes(oldDefault));
      if (!stillReferenced) safeUnlink(oldDefault);
    }
    res.json(db.getSettings());
  } catch (err) {
    cleanupUploadedFiles([req.file]);
    next(err);
  }
});

module.exports = router;
