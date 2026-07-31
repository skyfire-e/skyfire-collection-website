const { Router } = require('express');
const { requireAdmin } = require('../middleware');
const db = require('../db');

const router = Router();

router.get('/audit', requireAdmin, (req, res, next) => {
  try {
    const logs = db.getAuditLog(100);
    res.json(logs.map(l => ({ ...db.safeJsonParse(l.data, {}), id: l.id, timestamp: l.timestamp, action: l.action })));
  } catch (err) { next(err); }
});

module.exports = router;
