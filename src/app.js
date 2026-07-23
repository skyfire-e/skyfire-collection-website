const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { ValidationError, DataCorruptionError, VersionConflictError } = require('./errors');
const { readJSON, writeJSONAtomic, secureCookies, DATA_DIR, ITEMS_FILE, ROOT } = require('./helpers');

// Init data files and session storage
['items.json'].forEach(f => {
  const fp = path.join(DATA_DIR, f);
  if (!require('fs').existsSync(fp)) writeJSONAtomic(fp, []);
});
const SESSION_DIR = path.join(DATA_DIR, 'sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'skyfire.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new FileStore({ path: SESSION_DIR, ttl: 86400, reapInterval: 3600 }),
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
  if (error instanceof DataCorruptionError) {
    return res.status(error.status).json({ error: error.message });
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
