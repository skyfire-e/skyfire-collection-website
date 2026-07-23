const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');

require('dotenv').config();

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error('Missing required env vars: SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD');
  console.error('Create a .env file in the project root with these values.');
  process.exit(1);
}

class ValidationError extends Error {
  constructor(message, details) { super(message); this.name = 'ValidationError'; this.status = 400; this.details = details; }
}
class DataCorruptionError extends Error {
  constructor(message) { super(message); this.name = 'DataCorruptionError'; this.status = 500; }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials from .env
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Data setup ---
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    console.error('Corrupted JSON in ' + file + ':', e.message);
    throw new DataCorruptionError(file);
  }
}

function writeJSONAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw error;
  }
}

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

function safeUnlink(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return;
  const target = path.resolve(UPLOADS_DIR, path.basename(imgPath));
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  try { fs.unlinkSync(target); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const f of Array.isArray(files) ? files : [files]) {
    try { fs.unlinkSync(f.path); } catch (e) { if (e.code !== 'ENOENT') console.error(e); }
  }
}

const TEMP_DIR = path.join(UPLOADS_DIR, '.tmp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

async function normalizeImage(file) {
  const filename = crypto.randomUUID() + '.jpg';
  const destination = path.join(UPLOADS_DIR, filename);
  try {
    await sharp(file.path, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(destination);
  } finally {
    try { fs.unlinkSync(file.path); } catch {}
  }
  return '/uploads/' + filename;
}

function findCategory(subcategories, targetId) {
  for (const cat of subcategories || []) {
    if (cat.id === targetId) return cat;
    const nested = findCategory(cat.subcategories, targetId);
    if (nested) return nested;
  }
  return null;
}

function validateItemInput(body, cats, partial) {
  const errors = [];
  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  const section = body.section !== undefined ? String(body.section).trim() : undefined;
  const category = body.category !== undefined ? String(body.category).trim() : undefined;
  const price = body.price !== undefined ? String(body.price).trim() : undefined;

  if (!partial || body.title !== undefined) {
    if (!title) errors.push('Title is required and must be non-empty');
  }
  if (!partial || body.section !== undefined) {
    if (!section) errors.push('Section is required');
    else if (!cats[section]) errors.push('Section "' + section + '" does not exist');
  }
  if (!partial || body.category !== undefined) {
    if (!category) errors.push('Category is required');
    else if (section && cats[section] && !findCategory(cats[section].subcategories, category)) {
      errors.push('Category "' + category + '" does not exist in section "' + section + '"');
    }
  }
  if (!partial || body.price !== undefined) {
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) errors.push('Invalid price format');
  }

  return errors.length > 0 ? errors : null;
}

function validateFinalOrder(order, oldImages, uploadedFiles, removedIndexes) {
  if (!Array.isArray(order)) return 'finalOrder must be an array';
  if (!order.every(Number.isInteger)) return 'finalOrder must contain integers';
  if (order.some(v => v < -1)) return 'finalOrder contains an invalid value';

  const existingIndexes = order.filter(v => v >= 0);
  if (new Set(existingIndexes).size !== existingIndexes.length) return 'Duplicate image indexes are not allowed';

  if (existingIndexes.some(idx => idx >= oldImages.length)) return 'finalOrder references a missing image';

  if (removedIndexes && existingIndexes.some(idx => removedIndexes.includes(idx))) {
    return 'finalOrder references a removed image';
  }

  const uploadSlots = order.filter(v => v === -1).length;
  if (uploadSlots !== uploadedFiles.length) return 'Uploaded files do not match finalOrder';

  if (order.length > 10) return 'Maximum 10 images allowed';
  return null;
}

function parseJSONArray(value, fieldName) {
  if (value === undefined) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(fieldName + ' must be an array');
    return parsed;
  } catch (e) {
    const err = new Error(e.message || 'Invalid JSON for ' + fieldName);
    err.statusCode = 400;
    err.field = fieldName;
    throw err;
  }
}

// Init data files (only items.json — auth via .env)
['items.json'].forEach(f => {
  const fp = path.join(DATA_DIR, f);
  if (!fs.existsSync(fp)) writeJSONAtomic(fp, []);
});

// Single admin user from .env
const users = [{ username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin' }];

function envBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const secureCookies = envBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production');

// --- Middleware ---
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'skyfire.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File upload ---
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  dest: TEMP_DIR,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG and WebP are allowed'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 30 }
});

// --- Auth middleware ---
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

// --- API Routes ---

// Auth
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { username: user.username, role: user.role };
    res.json({ success: true, user: { username: user.username, role: user.role } });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout error' });
    res.clearCookie('skyfire.sid', { httpOnly: true, secure: secureCookies, sameSite: 'lax' });
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session?.user) return res.json({ user: req.session.user });
  res.json({ user: null });
});

// Categories
app.get('/api/categories', (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  res.json(cats);
});

app.post('/api/categories', requireSameOrigin, requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const { section, label, id, parentId } = req.body;

  if (!label) return res.status(400).json({ error: 'Label is required' });

  const catId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (parentId === '__new_section__') {
    // Create new top-level section
    if (cats[catId]) return res.status(400).json({ error: 'Section already exists' });
    cats[catId] = { label, subcategories: [] };
  } else if (parentId && section && cats[section]) {
    // Add subcategory under a group within the section
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (parent && parent.subcategories) {
      if (findCategory(cats[section].subcategories, catId)) {
        return res.status(409).json({ error: 'Category ID "' + catId + '" already exists' });
      }
      parent.subcategories.push({ id: catId, label });
    } else {
      return res.status(400).json({ error: 'Parent not found or not a group' });
    }
  } else if (section && cats[section]) {
    // Add flat subcategory to section root
    if (findCategory(cats[section].subcategories, catId)) {
      return res.status(409).json({ error: 'Category ID "' + catId + '" already exists' });
    }
    cats[section].subcategories.push({ id: catId, label });
  } else {
    return res.status(400).json({ error: 'Invalid target' });
  }

  writeJSONAtomic(CATEGORIES_FILE, cats);
  res.json(cats);
});

app.delete('/api/categories', requireSameOrigin, requireAdmin, (req, res) => {
  const cats = readJSON(CATEGORIES_FILE);
  const items = readJSON(ITEMS_FILE) || [];
  const { section, id, parentId } = req.body;

  if (!section || !cats[section]) return res.status(400).json({ error: 'Invalid section' });

  function collectIds(cat) {
    const ids = [cat.id];
    if (cat.subcategories) cat.subcategories.forEach(sc => ids.push(...collectIds(sc)));
    return ids;
  }

  let affectedCats = [];
  if (!id) {
    // Delete entire section — check ALL items in this section
    const sectionItems = items.filter(i => i.section === section);
    if (sectionItems.length > 0) {
      return res.status(409).json({
        error: `Cannot delete section "${section}": ${sectionItems.length} items still reference it`
      });
    }
  } else if (parentId) {
    // Delete nested subcategory within a group
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    if (!parent || !parent.subcategories) return res.status(400).json({ error: 'Parent not found' });
    const target = parent.subcategories.find(c => c.id === id);
    if (!target) return res.status(404).json({ error: 'Category not found' });
    affectedCats = collectIds(target);
  } else {
    // Delete flat subcategory or group
    const target = cats[section].subcategories.find(c => c.id === id);
    if (!target) return res.status(404).json({ error: 'Category not found' });
    if (target.type === 'group' && target.subcategories) {
      affectedCats = collectIds(target);
    } else {
      affectedCats = [id];
    }
  }

  if (affectedCats.length > 0) {
    const linked = items.filter(i => i.section === section && affectedCats.includes(i.category));
    if (linked.length > 0) {
      return res.status(409).json({
        error: `Cannot delete category: ${linked.length} items still reference it`
      });
    }
  }

  if (!id) {
    delete cats[section];
  } else if (parentId) {
    const parent = cats[section].subcategories.find(c => c.id === parentId);
    parent.subcategories = parent.subcategories.filter(c => c.id !== id);
  } else {
    cats[section].subcategories = cats[section].subcategories.filter(c => c.id !== id);
  }

  writeJSONAtomic(CATEGORIES_FILE, cats);
  res.json(cats);
});

// Items
app.get('/api/items', (req, res) => {
  let items = readJSON(ITEMS_FILE) || [];
  const { section, category } = req.query;
  if (section) items = items.filter(i => i.section === section);
  if (category) items = items.filter(i => i.category === category);
  res.json(items);
});

app.post('/api/items', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const items = readJSON(ITEMS_FILE) || [];
    const cats = readJSON(CATEGORIES_FILE) || {};
    const settings = readJSON(SETTINGS_FILE) || {};
    const files = req.files || [];

    const errors = validateItemInput(req.body, cats);
    if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

    const images = await Promise.all(files.map(normalizeImage));
    const newItem = {
      id: crypto.randomUUID(),
      section: req.body.section,
      category: req.body.category,
      title: req.body.title || 'Untitled',
      author: req.body.author || '',
      price: req.body.price || '',
      recaster: req.body.recaster || '',
      combatPoints: req.body.combatPoints || '',
      status: req.body.status || '',
      image: images.length > 0 ? images[0] : (settings.defaultImage || '/images/default.svg'),
      images: images,
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    try {
      writeJSONAtomic(ITEMS_FILE, items);
    } catch (err) {
      cleanupUploadedFiles(files);
      console.error('Failed to save items.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    res.status(201).json(newItem);
  } catch (err) { next(err); }
});

app.put('/api/items/:id', requireSameOrigin, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const items = readJSON(ITEMS_FILE) || [];
    const cats = readJSON(CATEGORIES_FILE) || {};
    const files = req.files || [];
    const idx = items.findIndex(i => i.id == req.params.id);
    if (idx === -1) { cleanupUploadedFiles(files); return res.status(404).json({ error: 'Not found' }); }

    const candidate = {
      ...items[idx],
      ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
      ...(req.body.author !== undefined && { author: req.body.author }),
      ...(req.body.section !== undefined && { section: String(req.body.section).trim() }),
      ...(req.body.category !== undefined && { category: String(req.body.category).trim() }),
      ...(req.body.price !== undefined && { price: String(req.body.price).trim() }),
      ...(req.body.recaster !== undefined && { recaster: req.body.recaster }),
      ...(req.body.combatPoints !== undefined && { combatPoints: req.body.combatPoints }),
      ...(req.body.status !== undefined && { status: req.body.status })
    };
    const errors = validateItemInput(candidate, cats);
    if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

    const newFilePaths = await Promise.all(files.map(normalizeImage));

    if (!Array.isArray(candidate.images)) candidate.images = [];
    const oldImages = [...candidate.images];

    let removeIdx = [];
    let finalOrder = [];
    try {
      removeIdx = parseJSONArray(req.body.imagesToRemove, 'imagesToRemove');
      finalOrder = parseJSONArray(req.body.finalOrder, 'finalOrder');
    } catch (e) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: e.message });
    }

    if (!Array.isArray(removeIdx) || !removeIdx.every(Number.isInteger) || removeIdx.some(v => v < 0)) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: 'imagesToRemove must contain non-negative integers' });
    }

    if (finalOrder.length > 0) {
      const validationError = validateFinalOrder(finalOrder, oldImages, newFilePaths, removeIdx);
      if (validationError) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: validationError });
      }

      const removedSet = new Set(removeIdx);
      const originalMap = {};
      oldImages.forEach((img, i) => { if (!removedSet.has(i)) originalMap[Object.keys(originalMap).length] = img; });

      let fileIdx = 0;
      const newImages = [];
      for (const entry of finalOrder) {
        if (entry >= 0 && originalMap[entry] !== undefined) {
          newImages.push(originalMap[entry]);
        } else if (entry === -1 && fileIdx < newFilePaths.length) {
          newImages.push(newFilePaths[fileIdx++]);
        }
      }
      candidate.images = newImages;
    } else if (removeIdx.length > 0) {
      removeIdx.sort((a, b) => b - a).forEach(i => {
        if (i >= 0 && i < oldImages.length) oldImages.splice(i, 1);
      });
      candidate.images = oldImages;
      newFilePaths.forEach(p => candidate.images.push(p));
    } else if (newFilePaths.length > 0) {
      candidate.images = [...oldImages, ...newFilePaths];
    }

    if (candidate.images.length > 10) {
      cleanupUploadedFiles(files);
      return res.status(400).json({ error: 'Maximum 10 images per item' });
    }

    if (newFilePaths.length > 0 || removeIdx.length > 0 || finalOrder.length > 0) {
      if (candidate.images.length > 0) {
        candidate.image = candidate.images[0];
      } else {
        candidate.images = [];
        candidate.image = readJSON(SETTINGS_FILE)?.defaultImage || '/images/default.svg';
      }
    }

    items[idx] = candidate;

    try {
      writeJSONAtomic(ITEMS_FILE, items);
    } catch (err) {
      cleanupUploadedFiles(files);
      console.error('Failed to save items.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    const newSet = new Set(candidate.images);
    for (const img of oldImages) {
      if (!newSet.has(img)) {
        const stillReferenced = items.some((other, oi) => oi !== idx && (other.image === img || other.images?.includes(img)));
        if (!stillReferenced) safeUnlink(img);
      }
    }

    res.json(candidate);
  } catch (err) { next(err); }
});

app.delete('/api/items/:id', requireSameOrigin, requireAdmin, (req, res) => {
  let items = readJSON(ITEMS_FILE) || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const deletedItem = items[idx];
  const imagesToRemove = [deletedItem.image, ...(deletedItem.images || [])];
  items.splice(idx, 1);

  try {
    writeJSONAtomic(ITEMS_FILE, items);
  } catch (err) {
    console.error('Failed to save items.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }

  const uniquePaths = [...new Set(imagesToRemove.filter(Boolean))];
  for (const img of uniquePaths) {
    const stillReferenced = items.some(other => other.image === img || other.images?.includes(img));
    if (!stillReferenced) safeUnlink(img);
  }

  res.json({ success: true });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

app.put('/api/settings', requireSameOrigin, requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE) || {};
  if (req.body.siteName !== undefined) {
    if (typeof req.body.siteName !== 'string') return res.status(400).json({ error: 'siteName must be a string' });
    settings.siteName = req.body.siteName;
  }
  if (req.body.showSpreadsheet !== undefined) {
    if (typeof req.body.showSpreadsheet !== 'boolean') return res.status(400).json({ error: 'showSpreadsheet must be boolean' });
    settings.showSpreadsheet = req.body.showSpreadsheet;
  }
  if (req.body.showPublicSpreadsheet !== undefined) {
    if (typeof req.body.showPublicSpreadsheet !== 'boolean') return res.status(400).json({ error: 'showPublicSpreadsheet must be boolean' });
    settings.showPublicSpreadsheet = req.body.showPublicSpreadsheet;
  }
  if (req.body.showMiniaturesColumns !== undefined) {
    if (typeof req.body.showMiniaturesColumns !== 'object' || req.body.showMiniaturesColumns === null || Array.isArray(req.body.showMiniaturesColumns)) {
      return res.status(400).json({ error: 'showMiniaturesColumns must be an object' });
    }
    settings.showMiniaturesColumns = req.body.showMiniaturesColumns;
  }
  if (req.body.currencies !== undefined) {
    if (typeof req.body.currencies !== 'object' || req.body.currencies === null || Array.isArray(req.body.currencies)) {
      return res.status(400).json({ error: 'currencies must be an object' });
    }
    settings.currencies = req.body.currencies;
  }
  writeJSONAtomic(SETTINGS_FILE, settings);
  res.json(settings);
});

// Public spreadsheet endpoint (no auth required)
app.get('/api/spreadsheet/public', (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE) || {};
  const settings = readJSON(SETTINGS_FILE) || {};
  const showPrices = settings.showPublicSpreadsheet !== false;
  const currencies = settings.currencies || {};

  const result = [];
  for (const [sectionId, section] of Object.entries(cats)) {
    const sectionData = { id: sectionId, label: section.label, subcategories: [], sum: 0, totalItems: 0, currency: currencies[sectionId] || '' };
    const showColumns = settings.showMiniaturesColumns || {};

    // Flatten subcategories including nested group children
    const flatSubs = [];
    section.subcategories.forEach(c => {
      if (c.type === 'group' && c.subcategories) {
        c.subcategories.forEach(sc => {
          flatSubs.push({ id: sc.id, label: sc.label, groupLabel: c.label });
        });
      } else {
        flatSubs.push({ id: c.id, label: c.label, groupLabel: null });
      }
    });

    flatSubs.forEach(sub => {
      const subItems = items.filter(i => i.section === sectionId && i.category === sub.id);
      const subSum = showPrices ? subItems.reduce((acc, i) => acc + (parseFloat(i.price) || 0), 0) : 0;
      sectionData.subcategories.push({
        id: sub.id,
        label: sub.label,
        groupLabel: sub.groupLabel,
        items: subItems.map(i => ({
          title: i.title,
          author: i.author,
          price: showPrices ? i.price : undefined,
          recaster: showColumns.recaster ? i.recaster : undefined,
          combatPoints: showColumns.combatPoints ? i.combatPoints : undefined,
          status: showColumns.status ? i.status : undefined,
        })),
        sum: subSum,
      });
      sectionData.sum += subSum;
      sectionData.totalItems += subItems.length;
    });

    sectionData.showPrices = showPrices;
    if (sectionId === 'miniatures') sectionData.showColumns = showColumns;
    result.push(sectionData);
  }
  res.json(result);
});

app.post('/api/upload/default', requireSameOrigin, requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const imagePath = await normalizeImage(req.file);
    const settings = readJSON(SETTINGS_FILE) || {};
    const oldDefault = settings.defaultImage;
    settings.defaultImage = imagePath;
    try {
      writeJSONAtomic(SETTINGS_FILE, settings);
    } catch (err) {
      cleanupUploadedFiles([req.file]);
      console.error('Failed to save settings.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    if (oldDefault && oldDefault !== settings.defaultImage) {
      const items = readJSON(ITEMS_FILE) || [];
      const stillReferenced = items.some(i => i.image === oldDefault || i.images?.includes(oldDefault));
      if (!stillReferenced) safeUnlink(oldDefault);
    }
    res.json(settings);
  } catch (err) { next(err); }
});

// Spreadsheet endpoint (admin only)
app.get('/api/spreadsheet', requireSameOrigin, requireAdmin, (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  res.json(items);
});

// 404 for unknown API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Health check (before dynamic route handlers)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Page routes ---
const pages = {
  '/': 'index.html',
  '/dice': 'dice.html',
  '/miniatures': 'miniatures.html',
  '/gallery': 'gallery.html',
  '/admin': 'admin.html',
  '/spreadsheet': 'spreadsheet.html'
};

app.get(Object.keys(pages), (req, res) => {
  const page = pages[req.path];
  if (page) res.sendFile(path.join(__dirname, 'public', page));
});

// Subgroup pages for miniatures
app.get('/miniatures/:group', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'miniatures-subgroup.html'));
});

// Dynamic subgroup page for any section group (e.g., /trading-cards/pokemon)
app.get('/:section/:groupId', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(__dirname, 'public', 'miniatures-subgroup.html'));
  }
  next();
});

// Dynamic section page for any top-level category (e.g., /trading-cards)
app.get('/:section', (req, res, next) => {
  const known = ['admin', 'gallery', 'dice', 'miniatures', 'css', 'js', 'images', 'uploads'];
  if (known.includes(req.params.section) || req.params.section.startsWith('api')) return next();
  const cats = readJSON(CATEGORIES_FILE);
  if (cats[req.params.section]) {
    return res.sendFile(path.join(__dirname, 'public', 'section-page.html'));
  }
  next();
});

app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

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
  if (error.message === 'Unsupported image type' || error.message === 'Only JPEG, PNG and WebP are allowed') {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`skyf1re Collection running at http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal}: shutting down`);
  server.close(error => {
    if (error) { console.error(error); process.exit(1); }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
