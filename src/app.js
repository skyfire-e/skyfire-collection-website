const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { ValidationError, VersionConflictError } = require('./errors');
const { getSecureCookies, envBoolean, ROOT } = require('./helpers');

const app = express();

// Warn if a file shadows an API route (startup only)
if (fs.existsSync(path.join(ROOT, 'public', 'api'))) {
  console.warn('WARNING: public/api directory exists — this shadows API routes, bypassing auth!');
}

app.set('trust proxy', envBoolean(process.env.TRUST_PROXY) ? 1 : false);
app.use(compression());
app.use(morgan('tiny'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\''],
      scriptSrcAttr: null,
      styleSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'blob:'],
      fontSrc: ['\'self\'', 'data:'],
      objectSrc: ['\'none\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\''],
      frameAncestors: ['\'self\''],
      upgradeInsecureRequests: []
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting on mutation endpoints (skip GET/HEAD/OPTIONS)
// writeLimiter (~60 req/15min) applies to POST/PUT/DELETE, skips GET
// readLimiter (~200 req/15min) applies to GET on shared paths
// GET /api/items is counted only by readLimiter (writeLimiter skips it)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/items', writeLimiter);
app.use('/api/categories', writeLimiter);
app.use('/api/settings', writeLimiter);
app.use('/api/upload', writeLimiter);
app.use('/api/backfill-defaults', writeLimiter);
app.use('/api/backfill-images', writeLimiter);
app.use('/api/backfill-prices', writeLimiter);
app.use('/api/checkpoint', writeLimiter);

// Rate limiting on public read endpoints
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/auth/me', readLimiter);
app.use('/api/spreadsheet/public', readLimiter);
app.use('/api/items', readLimiter);
app.use('/api/categories', readLimiter);
app.use('/api/settings', readLimiter);
app.use('/api/spreadsheet', readLimiter);

// SQLite session store
const { getSession, setSession, destroySession, db: dbInstance } = require('./db');

const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000;

class SQLiteStore extends session.Store {
  get(sid, cb) {
    try {
      const data = getSession(sid);
      cb(null, data);
    } catch (err) { cb(err); }
  }
  set(sid, sessionData, cb) {
    try {
      const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || SESSION_MAX_AGE;
      setSession(sid, sessionData, maxAge);
      cb(null);
    } catch (err) { cb(err); }
  }
  destroy(sid, cb) {
    try {
      destroySession(sid);
      cb(null);
    } catch (err) { cb(err); }
  }
  touch(sid, sessionData, cb) {
    try {
      const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || SESSION_MAX_AGE;
      dbInstance.prepare('UPDATE sessions SET data = ?, expires = ? WHERE sid = ?')
        .run(JSON.stringify(sessionData), Date.now() + maxAge, sid);
      cb(null);
    } catch (err) { cb(err); }
  }
}

app.use(session({
  name: 'skyfire.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore(),
  cookie: {
    httpOnly: true,
    secure: getSecureCookies(),
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE
  }
}));

// Static files
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(path.join(ROOT, 'uploads'), {
  maxAge: '1y',
  immutable: true
}));

// API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/spreadsheet', require('./routes/spreadsheet'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api', require('./routes/backfill'));

// Checkpoint (must be before 404 handler)
app.use('/api', require('./routes/checkpoint'));

// 404 for unknown API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Page routes
app.use(require('./routes/pages'));

// Central error handler
app.use((error, req, res, next) => {
  if (res.headersSent) { return next(error); }
  console.error(error);
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload error', details: error.message });
  }
  if (error instanceof ValidationError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error instanceof VersionConflictError) {
    return res.status(error.status).json({ error: error.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
