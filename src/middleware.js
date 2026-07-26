const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { TEMP_DIR } = require('./helpers');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  dest: TEMP_DIR,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG and WebP are allowed'));
    cb(null, true);
  },
  limits: { fileSize: parseInt(process.env.UPLOAD_FILE_SIZE, 10) || 10 * 1024 * 1024, files: parseInt(process.env.UPLOAD_MAX_FILES, 10) || 10, fields: parseInt(process.env.UPLOAD_MAX_FIELDS, 10) || 30 }
});

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const referer = req.get('referer');
  const source = origin || referer;
  if (!source) return res.status(403).json({ error: 'Origin or Referer header is required' });
  let originHost;
  try { originHost = new URL(source).hostname; } catch { return res.status(403).json({ error: 'Invalid Origin header' }); }
  if (ALLOWED_ORIGINS.length > 0) {
    if (!ALLOWED_ORIGINS.includes(originHost)) return res.status(403).json({ error: 'Cross-origin request rejected' });
  } else if (originHost !== req.hostname) {
    return res.status(403).json({ error: 'Cross-origin request rejected' });
  }
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
