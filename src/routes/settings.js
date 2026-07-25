const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const { settingsSchema } = require('../../lib/validate');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  res.json(db.getSettings());
});

router.put('/', requireSameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const result = settingsSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.issues.map(i => i.message) });
    }
    db.updateSettings(result.data);
    res.json(db.getSettings());
  } catch (err) { next(err); }
});

module.exports = router;
