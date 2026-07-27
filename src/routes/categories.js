const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const { findCategory, STATIC_ROUTES } = require('../helpers');
const { slugify } = require('../slugify');
const { categoryInputSchema } = require('../../lib/validate');
const db = require('../db');

const NEW_SECTION_MAGIC = '__new_section__';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.getCategories());
});

router.post('/', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const result = categoryInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.issues.map(i => i.message) });
    }
    const { section, label, id, parentId, isGroup } = result.data;

    let catId;

    const DANGEROUS_IDS = ['__proto__', 'constructor', 'prototype'];
    if (id && DANGEROUS_IDS.includes(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    if (section && DANGEROUS_IDS.includes(section)) {
      return res.status(400).json({ error: 'Invalid section' });
    }

    try {
      const cats = db.getCategories();

      if (parentId === NEW_SECTION_MAGIC) {
        catId = id || slugify(label);
        if (!catId) return res.status(400).json({ error: 'Could not generate category ID. Specify an ID manually.' });
        if (STATIC_ROUTES.includes(catId)) throw Object.assign(new Error('Section ID "' + catId + '" is reserved'), { status: 400 });
        if (cats[catId]) throw Object.assign(new Error('Section already exists'), { status: 400 });
        cats[catId] = { label, subcategories: [] };
      } else if (parentId && section && cats[section]) {
        const parent = cats[section].subcategories.find(c => c.id === parentId);
        if (parent && parent.subcategories) {
          if (isGroup) {
            throw Object.assign(new Error('Nested groups are not supported'), { status: 400 });
          }
          catId = id || slugify(label);
          if (!catId) return res.status(400).json({ error: 'Could not generate category ID. Specify an ID manually.' });
          if (findCategory(cats[section].subcategories, catId)) {
            throw Object.assign(new Error('Category ID "' + catId + '" already exists'), { status: 409 });
          }
          const newCat = { id: catId, label };
          parent.subcategories.push(newCat);
        } else {
          throw Object.assign(new Error('Parent not found or not a group'), { status: 400 });
        }
      } else if (section && cats[section]) {
        catId = id || slugify(label);
        if (!catId) return res.status(400).json({ error: 'Could not generate category ID. Specify an ID manually.' });
        if (findCategory(cats[section].subcategories, catId)) {
          throw Object.assign(new Error('Category ID "' + catId + '" already exists'), { status: 409 });
        }
        const newCat = isGroup ? { id: catId, label, type: 'group', subcategories: [] } : { id: catId, label };
        cats[section].subcategories.push(newCat);
      } else {
        throw Object.assign(new Error('Invalid target'), { status: 400 });
      }

      db.saveCategories(cats);
      db.appendAudit({ action: 'category.create', section, categoryId: catId, label, parentId });
      res.json(cats);
    } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); throw err; }
  } catch (err) { next(err); }
});

router.delete('/', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const { section, id, parentId } = req.query;

    if (!section) return res.status(400).json({ error: 'Invalid section' });
    const DANGEROUS = ['__proto__', 'constructor', 'prototype'];
    if (DANGEROUS.includes(section) || (id && DANGEROUS.includes(id))) {
      return res.status(400).json({ error: 'Invalid section or category ID' });
    }

    try {
      const cats = db.getCategories();
      const items = db.allItems();

      if (!cats[section]) throw Object.assign(new Error('Invalid section'), { status: 400 });

      function collectIds(cat) {
        const ids = [];
        const stack = [cat];
        while (stack.length > 0) {
          const current = stack.pop();
          ids.push(current.id);
          if (current.subcategories) {
            for (const sc of current.subcategories) {
              stack.push(sc);
            }
          }
        }
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

      db.saveCategories(cats);
      db.appendAudit({ action: 'category.delete', section, categoryId: id || section, parentId });
      res.json(cats);
    } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); throw err; }
  } catch (err) { next(err); }
});

module.exports = router;
