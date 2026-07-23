const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { TEMP_DIR, envBoolean } = require('./helpers');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  dest: TEMP_DIR,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG and WebP are allowed'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 30 }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.user?.role === 'admin') return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const referer = req.get('referer');
  const source = origin || referer;
  if (!source) return res.status(403).json({ error: 'Origin or Referer header is required' });
  let originHost;
  try { originHost = new URL(source).host; } catch { return res.status(403).json({ error: 'Invalid Origin header' }); }
  if (originHost !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request rejected' });
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' }
});

module.exports = { upload, requireAdmin, requireSameOrigin, loginLimiter };
