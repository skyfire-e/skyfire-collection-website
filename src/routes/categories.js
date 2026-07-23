const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const { readJSON, writeJSONAtomic, findCategory, withDataLock, appendAudit, CATEGORIES_FILE, ITEMS_FILE } = require('../helpers');

const router = Router();

router.get('/', (req, res) => {
  res.json(readJSON(CATEGORIES_FILE));
});

router.post('/', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const { section, label, id, parentId } = req.body;

    if (!label) return res.status(400).json({ error: 'Label is required' });

    const catId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (!catId) return res.status(400).json({ error: 'Could not generate category ID. Specify an ID for non-Latin labels.' });

    const result = await withDataLock(() => {
      const cats = readJSON(CATEGORIES_FILE);

      if (parentId === '__new_section__') {
        if (cats[catId]) throw Object.assign(new Error('Section already exists'), { status: 400 });
        cats[catId] = { label, subcategories: [] };
      } else if (parentId && section && cats[section]) {
        const parent = cats[section].subcategories.find(c => c.id === parentId);
        if (parent && parent.subcategories) {
          if (findCategory(cats[section].subcategories, catId)) {
            throw Object.assign(new Error('Category ID "' + catId + '" already exists'), { status: 409 });
          }
          parent.subcategories.push({ id: catId, label });
        } else {
          throw Object.assign(new Error('Parent not found or not a group'), { status: 400 });
        }
      } else if (section && cats[section]) {
        if (findCategory(cats[section].subcategories, catId)) {
          throw Object.assign(new Error('Category ID "' + catId + '" already exists'), { status: 409 });
        }
        cats[section].subcategories.push({ id: catId, label });
      } else {
        throw Object.assign(new Error('Invalid target'), { status: 400 });
      }

      writeJSONAtomic(CATEGORIES_FILE, cats);
      return cats;
    });
    appendAudit({ action: 'category.create', section, categoryId: catId, label, parentId });
    res.json(result);
  } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
});

router.delete('/', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const { section, id, parentId } = req.body;

    if (!section) return res.status(400).json({ error: 'Invalid section' });

    const result = await withDataLock(() => {
      const cats = readJSON(CATEGORIES_FILE);
      const items = readJSON(ITEMS_FILE) || [];

      if (!cats[section]) throw Object.assign(new Error('Invalid section'), { status: 400 });

      function collectIds(cat) {
        const ids = [cat.id];
        if (cat.subcategories) cat.subcategories.forEach(sc => ids.push(...collectIds(sc)));
        return ids;
      }

      let affectedCats = [];
      if (!id) {
        const sectionItems = items.filter(i => i.section === section);
        if (sectionItems.length > 0) {
          throw Object.assign(new Error('Cannot delete section "' + section + '": ' + sectionItems.length + ' items still reference it'), { status: 409 });
        }
      } else if (parentId) {
        const parent = cats[section].subcategories.find(c => c.id === parentId);
        if (!parent || !parent.subcategories) throw Object.assign(new Error('Parent not found'), { status: 400 });
        const target = parent.subcategories.find(c => c.id === id);
        if (!target) throw Object.assign(new Error('Category not found'), { status: 404 });
        affectedCats = collectIds(target);
      } else {
        const target = cats[section].subcategories.find(c => c.id === id);
        if (!target) throw Object.assign(new Error('Category not found'), { status: 404 });
        if (target.type === 'group' && target.subcategories) {
          affectedCats = collectIds(target);
        } else {
          affectedCats = [id];
        }
      }

      if (affectedCats.length > 0) {
        const linked = items.filter(i => i.section === section && affectedCats.includes(i.category));
        if (linked.length > 0) {
          throw Object.assign(new Error('Cannot delete category: ' + linked.length + ' items still reference it'), { status: 409 });
        }
      }

      if (!id) {
        delete cats[section];
      } else if (parentId) {
        const parent = cats[section].subcategories.find(c => c.id === parentId);
        parent.subcategories = parent.subcategories.filter(c => c.id !== id);
      } else {
        cats[section].subcategories = cats[section].subcategories.filter(c => c.id !== id);
      }

      writeJSONAtomic(CATEGORIES_FILE, cats);
      return cats;
    });
    appendAudit({ action: 'category.delete', section, categoryId: id || section, parentId });
    res.json(result);
  } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
});

module.exports = router;
