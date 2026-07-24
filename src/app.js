const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { ValidationError, VersionConflictError } = require('./errors');
const { secureCookies, ROOT } = require('./helpers');

const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: null,
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting on mutation endpoints
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/items', writeLimiter);
app.use('/api/categories', writeLimiter);
app.use('/api/settings', writeLimiter);
app.use('/api/upload', writeLimiter);
app.use('/api/backfill-defaults', writeLimiter);
app.use('/api/backfill-images', writeLimiter);
app.use('/api/backfill-prices', writeLimiter);

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

// SQLite session store
const { getSession, setSession, destroySession } = require('./db');

const SQLiteStore = function() {};
SQLiteStore.prototype.__proto__ = session.Store.prototype;
SQLiteStore.prototype.get = function(sid, cb) {
  const data = getSession(sid);
  cb(null, data);
};
SQLiteStore.prototype.set = function(sid, sessionData, cb) {
  setSession(sid, sessionData, this.maxAge);
  cb(null);
};
SQLiteStore.prototype.destroy = function(sid, cb) {
  destroySession(sid);
  cb(null);
};
SQLiteStore.prototype.touch = function(sid, sessionData, cb) {
  setSession(sid, sessionData, this.maxAge);
  cb(null);
};

app.use(session({
  name: 'skyfire.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore(),
  cookie: {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Static files
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/spreadsheet', require('./routes/spreadsheet'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api', require('./routes/backfill'));

// 404 for unknown API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Page routes
app.use(require('./routes/pages'));

// Central error handler
app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload error', details: error.message });
  }
  if (error instanceof ValidationError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error instanceof VersionConflictError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.message === 'Unsupported image type' || error.message === 'Only JPEG, PNG and WebP are allowed') {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
