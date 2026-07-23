const { Router } = require('express');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  readJSON, writeJSONAtomic, safeUnlink, cleanupUploadedFiles, normalizeImage,
  withDataLock,
  SETTINGS_FILE, ITEMS_FILE
} = require('../helpers');

const router = Router();

router.post('/default', requireSameOrigin, requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const imagePath = await normalizeImage(req.file);
    let oldDefault;
    await withDataLock(() => {
      const settings = readJSON(SETTINGS_FILE) || {};
      oldDefault = settings.defaultImage;
      settings.defaultImage = imagePath;
      try {
        writeJSONAtomic(SETTINGS_FILE, settings);
      } catch (err) {
        cleanupUploadedFiles([req.file]);
        throw err;
      }
    });
    if (oldDefault && oldDefault !== imagePath) {
      const items = readJSON(ITEMS_FILE) || [];
      const stillReferenced = items.some(i => i.image === oldDefault || i.images?.includes(oldDefault));
      if (!stillReferenced) safeUnlink(oldDefault);
    }
    const settings = readJSON(SETTINGS_FILE);
    res.json(settings);
  } catch (err) { next(err); }
});

module.exports = router;
