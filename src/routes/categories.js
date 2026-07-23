const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const { readJSON, writeJSONAtomic, findCategory, CATEGORIES_FILE, ITEMS_FILE } = require('../helpers');

const router = Router();

router.get('/', (req, res) => {
  res.json(readJSON(CATEGORIES_FILE));
});

router.post('/', requireSameOrigin, requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const { section, label, id, parentId } = req.body;

  if (!label) return res.status(400).json({ error: 'Label is required' });

  const catId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (parentId === '__new_section__') {
    if (cats[catId]) return res.status(400).json({ error: 'Section already exists' });
    cats[catId] = { label, subcategories: [] };
  } else if (parentId && section && cats[section]) {
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (parent && parent.subcategories) {
      if (findCategory(cats[section].subcategories, catId)) {
        return res.status(409).json({ error: 'Category ID "' + catId + '" already exists' });
      }
      parent.subcategories.push({ id: catId, label });
    } else {
      return res.status(400).json({ error: 'Parent not found or not a group' });
    }
  } else if (section && cats[section]) {
    if (findCategory(cats[section].subcategories, catId)) {
      return res.status(409).json({ error: 'Category ID "' + catId + '" already exists' });
    }
    cats[section].subcategories.push({ id: catId, label });
  } else {
    return res.status(400).json({ error: 'Invalid target' });
  }

  writeJSONAtomic(CATEGORIES_FILE, cats);
  res.json(cats);
});

router.delete('/', requireSameOrigin, requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const items = readJSON(ITEMS_FILE) || [];
  const { section, id, parentId } = req.body;

  if (!section || !cats[section]) return res.status(400).json({ error: 'Invalid section' });

  function collectIds(cat) {
    const ids = [cat.id];
    if (cat.subcategories) cat.subcategories.forEach(sc => ids.push(...collectIds(sc)));
    return ids;
  }

  let affectedCats = [];
  if (!id) {
    const sectionItems = items.filter(i => i.section === section);
    if (sectionItems.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete section "' + section + '": ' + sectionItems.length + ' items still reference it'
      });
    }
  } else if (parentId) {
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (!parent || !parent.subcategories) return res.status(400).json({ error: 'Parent not found' });
    const target = parent.subcategories.find(c => c.id === id);
    if (!target) return res.status(404).json({ error: 'Category not found' });
    affectedCats = collectIds(target);
  } else {
    const target = cats[section].subcategories.find(c => c.id === id);
    if (!target) return res.status(404).json({ error: 'Category not found' });
    if (target.type === 'group' && target.subcategories) {
      affectedCats = collectIds(target);
    } else {
      affectedCats = [id];
    }
  }

  if (affectedCats.length > 0) {
    const linked = items.filter(i => i.section === section && affectedCats.includes(i.category));
    if (linked.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete category: ' + linked.length + ' items still reference it'
      });
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
  res.json(cats);
});

module.exports = router;
