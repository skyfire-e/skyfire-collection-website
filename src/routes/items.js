const { Router } = require('express');
const crypto = require('crypto');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  safeUnlink, cleanupUploadedFiles,
  normalizeImage, validateItemInput, validateFinalOrder, parseJSONArray,
  validateVersion,
} = require('../helpers');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { section, category } = req.query;
  const items = db.getItems(section, category);
  res.json(items);
});

router.post('/', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const cats = db.getCategories();
    const files = req.files || [];

    const validation = validateItemInput(req.body, cats);
    if (validation.errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: validation.errors }); }

    const { data } = validation;
    const images = await Promise.all(files.map(normalizeImage));
    const settings = db.getSettings();

    const item = {
      id: crypto.randomUUID(),
      section: data.section,
      category: data.category,
      title: data.title || 'Untitled',
      author: data.author || '',
      price: data.price ?? 0,
      recaster: data.recaster || '',
      combatPoints: data.combatPoints || '',
      status: data.status || '',
      version: 1,
      image: images.length > 0 ? images[0] : (settings.defaultImage || '/images/default.svg'),
      images: images,
      createdAt: new Date().toISOString()
    };
    db.insertItem(item);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const cats = db.getCategories();
    const files = req.files || [];

    const currentItem = db.getItem(req.params.id);
    if (!currentItem) { cleanupUploadedFiles(files); return res.status(404).json({ error: 'Not found' }); }

    const candidate = {
      ...currentItem,
      ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
      ...(req.body.author !== undefined && { author: req.body.author }),
      ...(req.body.section !== undefined && { section: String(req.body.section).trim() }),
      ...(req.body.category !== undefined && { category: String(req.body.category).trim() }),
      ...(req.body.price !== undefined && {}),
      ...(req.body.recaster !== undefined && { recaster: req.body.recaster }),
      ...(req.body.combatPoints !== undefined && { combatPoints: req.body.combatPoints }),
      ...(req.body.status !== undefined && { status: req.body.status })
    };
    const validation = validateItemInput(candidate, cats);
    if (validation.errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: validation.errors }); }
    if (validation.data && req.body.price !== undefined) {
      candidate.price = validation.data.price;
    }

    const newFilePaths = await Promise.all(files.map(normalizeImage));

    if (!Array.isArray(candidate.images)) candidate.images = [];
    const oldImages = [...candidate.images];

    let removeIdx = [];
    let finalOrder = [];
    try {
      removeIdx = parseJSONArray(req.body.imagesToRemove, 'imagesToRemove');
      finalOrder = parseJSONArray(req.body.finalOrder, 'finalOrder');
    } catch (e) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: e.message });
    }

    if (!Array.isArray(removeIdx) || !removeIdx.every(Number.isInteger) || removeIdx.some(v => v < 0)) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: 'imagesToRemove must contain non-negative integers' });
    }

    if (finalOrder.length > 0) {
      const validationError = validateFinalOrder(finalOrder, oldImages, newFilePaths, removeIdx);
      if (validationError) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: validationError });
      }

      const removedSet = new Set(removeIdx);
      const originalMap = {};
      oldImages.forEach((img, i) => { if (!removedSet.has(i)) originalMap[i] = img; });

      let fileIdx = 0;
      const newImages = [];
      for (const entry of finalOrder) {
        if (entry >= 0 && originalMap[entry] !== undefined) {
          newImages.push(originalMap[entry]);
        } else if (entry === -1 && fileIdx < newFilePaths.length) {
          newImages.push(newFilePaths[fileIdx++]);
        }
      }
      candidate.images = newImages;
    } else if (removeIdx.length > 0) {
      removeIdx.sort((a, b) => b - a).forEach(i => {
        if (i >= 0 && i < oldImages.length) oldImages.splice(i, 1);
      });
      candidate.images = oldImages;
      newFilePaths.forEach(p => candidate.images.push(p));
    } else if (newFilePaths.length > 0) {
      candidate.images = [...oldImages, ...newFilePaths];
    }

    if (candidate.images.length > 10) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: 'Maximum 10 images per item' });
    }

    if (newFilePaths.length > 0 || removeIdx.length > 0 || finalOrder.length > 0) {
      if (candidate.images.length > 0) {
        candidate.image = candidate.images[0];
      } else {
        candidate.images = [];
        candidate.image = db.getSettings().defaultImage || '/images/default.svg';
      }
    }

    validateVersion(currentItem, req.body.version);
    candidate.version = (currentItem.version || 0) + 1;

    const oldImagesForCleanup = [...(currentItem.images || [])];

    db.updateItem(currentItem.id, candidate);

    const newSet = new Set(candidate.images);
    for (const img of oldImagesForCleanup) {
      if (!newSet.has(img)) {
        const items = db.allItems();
        const stillReferenced = items.some(other => other.id !== candidate.id && (other.image === img || other.images?.includes(img)));
        if (!stillReferenced) safeUnlink(img);
      }
    }

    db.appendAudit({ action: 'item.update', entityId: candidate.id, title: candidate.title });
    res.json(candidate);
  } catch (err) { next(err); }
});

router.delete('/:id', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const deletedItem = db.getItem(req.params.id);
    if (!deletedItem) return res.status(404).json({ error: 'Not found' });

    const uniquePaths = [...new Set([deletedItem.image, ...(deletedItem.images || [])].filter(Boolean))];

    db.deleteItem(req.params.id);
    db.appendAudit({ action: 'item.delete', entityId: deletedItem.id, title: deletedItem.title });

    const currentItems = db.allItems();
    for (const img of uniquePaths) {
      const stillReferenced = currentItems.some(other => other.image === img || other.images?.includes(img));
      if (!stillReferenced) safeUnlink(img);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
