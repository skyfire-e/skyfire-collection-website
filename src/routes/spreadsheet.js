const { Router } = require('express');
const { requireAdmin } = require('../middleware');
const { flattenCategories } = require('../helpers');
const db = require('../db');

const router = Router();

router.get('/public', (req, res) => {
  const items = db.allItems();
  const cats = db.getCategories();
  const settings = db.getSettings();
  if (settings.showSpreadsheet === false) return res.status(403).json({ error: 'Spreadsheet is disabled' });
  const showPrices = settings.showPublicSpreadsheet !== false;
  const currencies = settings.currencies || {};

  const showColumns = settings.showMiniaturesColumns || {};
  const extraFieldsSections = settings.sectionsWithExtraFields || [];

  const result = [];
  for (const [sectionId, section] of Object.entries(cats)) {
    const currencyCode = currencies[sectionId] || 'USD';
    const sectionData = { id: sectionId, label: section.label, subcategories: [], sum: 0, totalItems: 0, currency: currencyCode };

    const flatSubs = flattenCategories(section.subcategories);

    flatSubs.forEach(sub => {
      const subItems = items.filter(i => i.section === sectionId && i.category === sub.id);
      const subSum = showPrices ? subItems.reduce((acc, i) => acc + (Number(i.price) || 0), 0) : 0;
      sectionData.subcategories.push({
        id: sub.id,
        label: sub.label,
        path: sub.path,
        groupLabel: sub.groupLabel,
        items: subItems.map(i => ({
          title: i.title,
          author: i.author,
          price: showPrices ? (Number(i.price) || 0) : undefined,
          recaster: showColumns.recaster ? i.recaster : undefined,
          combatPoints: showColumns.combatPoints ? i.combatPoints : undefined,
          status: showColumns.status ? i.status : undefined,
        })),
        sum: subSum,
      });
      sectionData.sum += subSum;
      sectionData.totalItems += subItems.length;
    });

    sectionData.showPrices = showPrices;
    if (extraFieldsSections.includes(sectionId)) sectionData.showColumns = showColumns;
    result.push(sectionData);
  }
  res.json(result);
});

router.get('/', requireAdmin, (req, res) => {
  res.json(db.allItems());
});

module.exports = router;
