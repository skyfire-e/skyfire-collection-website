const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const db = require('../db');

const router = Router();

router.post('/checkpoint', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    db.db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.error('WAL checkpoint failed:', err.message);
  }
  res.json({ success: true });
});

module.exports = router;
