const { Router } = require('express');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  safeUnlink, cleanupUploadedFiles, normalizeImage,
} = require('../helpers');
const db = require('../db');

const router = Router();

router.post('/default', requireSameOrigin, requireAdmin, upload.single('image'), async (req, res, next) => {
  const file = req.file;
  let imagePath = null;
  try {
    if (!file) return res.status(400).json({ error: 'No file' });
    imagePath = await normalizeImage(file);
    const settings = db.getSettings();
    const oldDefault = settings.defaultImage;
    db.updateSettings({ defaultImage: imagePath });
    if (oldDefault && oldDefault !== imagePath) {
      const stillReferenced = db.countImageReferences(oldDefault) > 0;
      if (!stillReferenced) safeUnlink(oldDefault);
    }
    res.json(db.getSettings());
  } catch (err) {
    cleanupUploadedFiles([file]);
    if (imagePath) safeUnlink(imagePath);
    next(err);
  }
});

module.exports = router;
