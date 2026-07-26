const { Router } = require('express');
const crypto = require('crypto');
const { requireAdmin, requireSameOrigin, upload } = require('../middleware');
const {
  safeUnlink, cleanupUploadedFiles,
  normalizeImage, validateItemInput, validateFinalOrder, parseJSONArray,
  validateVersion, toNumber,
} = require('../helpers');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { section, category, limit, offset, q } = req.query;

  if (q) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;
    const items = db.searchItems(q, parsedLimit);
    if (limit !== undefined) {
      return res.json({ items, total: items.length, limit: parsedLimit, offset: 0 });
    }
    return res.json(items);
  }

  let parsedLimit;
  let hasLimit = false;
  if (limit !== undefined) {
    const n = parseInt(limit, 10);
    if (isNaN(n) || n < 0) return res.status(400).json({ error: 'limit must be a non-negative integer' });
    parsedLimit = n === 0 ? 0 : Math.min(n, 100);
    hasLimit = true;
  }
  const parsedOffset = offset ? Math.max(parseInt(offset, 10) || 0, 0) : undefined;
  if (hasLimit) {
    const items = db.getItems(section, category, parsedLimit, parsedOffset);
    const total = db.getItemCount(section, category);
    res.json({ items, total, limit: parsedLimit, offset: parsedOffset || 0 });
  } else {
    const items = db.getItems(section, category);
    res.json(items);
  }
});

router.post('/', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  const files = req.files || [];
  const createdPaths = [];
  try {
    const cats = db.getCategories();

    const validation = validateItemInput(req.body, cats);
    if (validation.errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: validation.errors }); }

    const { data } = validation;
    const images = await Promise.all(files.map(async (f) => {
      const p = await normalizeImage(f);
      createdPaths.push(p);
      return p;
    }));
    const settings = db.getSettings();

    const item = {
      id: crypto.randomUUID(),
      section: data.section,
      category: data.category,
      title: data.title,
      author: data.author || '',
      price: data.price ?? 0,
      recaster: data.recaster || '',
      combatPoints: data.combatPoints || '',
      status: data.status || '',
      version: 1,
      image: images.length > 0 ? images[0] : (settings.defaultImage || '/images/default.svg'),
      images: images,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.insertItem(item);
    db.appendAudit({ action: 'item.create', entityId: item.id, title: item.title });
    res.status(201).json(item);
  } catch (err) {
    cleanupUploadedFiles(files);
    createdPaths.forEach(p => safeUnlink(p));
    next(err);
  }
});

router.put('/:id', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  const files = req.files || [];
  let newFilePaths = [];
  try {
    const cats = db.getCategories();

    const currentItem = db.getItem(req.params.id);
    if (!currentItem) { cleanupUploadedFiles(files); return res.status(404).json({ error: 'Not found' }); }

    validateVersion(currentItem, req.body.version);

    const candidate = {
      ...currentItem,
      version: (currentItem.version || 0) + 1,
      ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
      ...(req.body.author !== undefined && { author: String(req.body.author).trim() }),
      ...(req.body.section !== undefined && { section: String(req.body.section).trim() }),
      ...(req.body.category !== undefined && { category: String(req.body.category).trim() }),
      ...(req.body.price !== undefined && { price: toNumber(req.body.price) }),
      ...(req.body.recaster !== undefined && { recaster: String(req.body.recaster).trim() }),
      ...(req.body.combatPoints !== undefined && { combatPoints: String(req.body.combatPoints).trim() }),
      ...(req.body.status !== undefined && { status: String(req.body.status).trim() })
    };
    const validation = validateItemInput(candidate, cats);
    if (validation.errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: validation.errors }); }

    const merged = {
      ...currentItem,
      version: (currentItem.version || 0) + 1,
      ...validation.data
    };

    newFilePaths = await Promise.all(files.map(normalizeImage));

    if (!Array.isArray(merged.images)) merged.images = [];
    const oldImages = [...merged.images];

    let removeIdx = [];
    let finalOrder = [];
    try {
      removeIdx = parseJSONArray(req.body.imagesToRemove, 'imagesToRemove');
      finalOrder = parseJSONArray(req.body.finalOrder, 'finalOrder');
    } catch (e) {
      cleanupUploadedFiles(files);
      newFilePaths.forEach(p => safeUnlink(p));
      return res.status(400).json({ error: e.message });
    }

    if (!Array.isArray(removeIdx) || !removeIdx.every(Number.isInteger) || removeIdx.some(v => v < 0) || removeIdx.some(v => v >= oldImages.length)) {
      cleanupUploadedFiles(files);
      newFilePaths.forEach(p => safeUnlink(p));
      return res.status(400).json({ error: 'imagesToRemove contains invalid or out-of-bounds indices' });
    }

    if (finalOrder.length > 0) {
      const validationError = validateFinalOrder(finalOrder, oldImages, newFilePaths, removeIdx);
      if (validationError) {
        cleanupUploadedFiles(files);
        newFilePaths.forEach(p => safeUnlink(p));
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
      merged.images = newImages;
    } else if (removeIdx.length > 0) {
      removeIdx.sort((a, b) => b - a).forEach(i => {
        if (i >= 0 && i < oldImages.length) oldImages.splice(i, 1);
      });
      merged.images = oldImages;
      newFilePaths.forEach(p => merged.images.push(p));
    } else if (newFilePaths.length > 0) {
      merged.images = [...oldImages, ...newFilePaths];
    }

    if (merged.images.length > 10) {
      cleanupUploadedFiles(files);
      newFilePaths.forEach(p => safeUnlink(p));
      return res.status(400).json({ error: 'Maximum 10 images per item' });
    }

    if (newFilePaths.length > 0 || removeIdx.length > 0 || finalOrder.length > 0) {
      if (merged.images.length > 0) {
        merged.image = merged.images[0];
      } else {
        merged.images = [];
        merged.image = db.getSettings().defaultImage || '/images/default.svg';
      }
    }

    const oldImagesForCleanup = [...(currentItem.images || [])];

    db.updateItem(currentItem.id, merged);

    const newSet = new Set(merged.images);
    const toDelete = [];
    for (const img of oldImagesForCleanup) {
      if (!newSet.has(img)) {
        const stillReferenced = db.countImageReferences(img, merged.id) > 0;
        if (!stillReferenced) toDelete.push(img);
      }
    }
    toDelete.forEach(img => safeUnlink(img));

    db.appendAudit({ action: 'item.update', entityId: merged.id, title: merged.title });
    res.json(merged);
  } catch (err) {
    cleanupUploadedFiles(files);
    newFilePaths.forEach(p => safeUnlink(p));
    next(err);
  }
});

router.delete('/:id', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const deletedItem = db.getItem(req.params.id);
    if (!deletedItem) return res.status(404).json({ error: 'Not found' });

    const uniquePaths = [...new Set([deletedItem.image, ...(deletedItem.images || [])].filter(Boolean))];

    db.deleteItem(req.params.id);
    db.appendAudit({ action: 'item.delete', entityId: deletedItem.id, title: deletedItem.title });

    const toDelete = [];
    for (const img of uniquePaths) {
      const stillReferenced = db.countImageReferences(img, deletedItem.id) > 0;
      if (!stillReferenced) toDelete.push(img);
    }
    toDelete.forEach(img => safeUnlink(img));
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/reorder', requireSameOrigin, requireAdmin, (req, res, next) => {
  try {
    const { section, category, items } = req.body;
    if (!section || typeof section !== 'string') return res.status(400).json({ error: 'Invalid section' });
    if (!category || typeof category !== 'string') return res.status(400).json({ error: 'Invalid category' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items array required' });
    db.reorderItems(section, category, items);
    res.json({ success: true, count: items.length });
  } catch (err) { next(err); }
});

module.exports = router;
