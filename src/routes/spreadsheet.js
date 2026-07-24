const { Router } = require('express');
const { requireAdmin } = require('../middleware');
const { flattenCategories } = require('../helpers');
const db = require('../db');

function formatPrice(amount, currencyCode) {
  if (amount == null || amount === 0) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return String(amount);
  }
}

const router = Router();

router.get('/public', (req, res) => {
  const items = db.allItems();
  const cats = db.getCategories();
  const settings = db.getSettings();
  const showPrices = settings.showPublicSpreadsheet !== false;
  const currencies = settings.currencies || {};

  const result = [];
  for (const [sectionId, section] of Object.entries(cats)) {
    const currencyCode = currencies[sectionId] || 'USD';
    const sectionData = { id: sectionId, label: section.label, subcategories: [], sum: 0, totalItems: 0, currency: currencyCode };
    const showColumns = settings.showMiniaturesColumns || {};

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
          priceFormatted: showPrices ? formatPrice(Number(i.price) || 0, currencyCode) : undefined,
          recaster: showColumns.recaster ? i.recaster : undefined,
          combatPoints: showColumns.combatPoints ? i.combatPoints : undefined,
          status: showColumns.status ? i.status : undefined,
        })),
        sum: subSum,
        sumFormatted: showPrices ? formatPrice(subSum, currencyCode) : undefined,
      });
      sectionData.sum += subSum;
      sectionData.totalItems += subItems.length;
    });

    sectionData.showPrices = showPrices;
    if (sectionId === 'miniatures') sectionData.showColumns = showColumns;
    result.push(sectionData);
  }
  res.json(result);
});

router.get('/', requireAdmin, (req, res) => {
  res.json(db.allItems());
});

module.exports = router;
