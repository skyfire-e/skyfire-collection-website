const { Router } = require('express');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  readJSON, writeJSONAtomic, safeUnlink, cleanupUploadedFiles, normalizeImage,
  SETTINGS_FILE, ITEMS_FILE
} = require('../helpers');

const router = Router();

router.post('/default', requireSameOrigin, requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const imagePath = await normalizeImage(req.file);
    const settings = readJSON(SETTINGS_FILE) || {};
    const oldDefault = settings.defaultImage;
    settings.defaultImage = imagePath;
    try {
      writeJSONAtomic(SETTINGS_FILE, settings);
    } catch (err) {
      cleanupUploadedFiles([req.file]);
      console.error('Failed to save settings.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    if (oldDefault && oldDefault !== settings.defaultImage) {
      const items = readJSON(ITEMS_FILE) || [];
      const stillReferenced = items.some(i => i.image === oldDefault || i.images?.includes(oldDefault));
      if (!stillReferenced) safeUnlink(oldDefault);
    }
    res.json(settings);
  } catch (err) { next(err); }
});

module.exports = router;
