const { Router } = require('express');
const { requireAdmin, requireSameOrigin } = require('../middleware');
const db = require('../db');

const router = Router();

router.post('/checkpoint', requireSameOrigin, requireAdmin, (req, res) => {
  try {
    const result = db.db.pragma('wal_checkpoint(TRUNCATE)');
    const row = Array.isArray(result) ? result[0] : result;
    // busy=1 means the checkpoint could not complete (e.g. a reader was active)
    if (row && row.busy === 1) {
      return res.status(503).json({ success: false, error: 'Checkpoint incomplete: database busy, try again', ...row });
    }
    res.json({ success: true, ...row });
  } catch (err) {
    console.error('WAL checkpoint failed:', err.message);
    res.status(500).json({ error: 'Checkpoint failed', details: err.message });
  }
});

module.exports = router;
