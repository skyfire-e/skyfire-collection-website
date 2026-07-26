const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const db = require('../db');

const router = Router();

router.post('/checkpoint', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    db.db.pragma('wal_checkpoint(TRUNCATE)');
    res.json({ success: true });
  } catch (err) {
    console.error('WAL checkpoint failed:', err.message);
    res.status(500).json({ error: 'Checkpoint failed', details: err.message });
  }
});

module.exports = router;
