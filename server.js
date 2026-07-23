const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error('Missing required env vars: SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD');
  console.error('Create a .env file in the project root with these values.');
  process.exit(1);
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
    throw e;
  }
}

function writeJSONAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
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

function validateFinalOrder(order, oldImages, uploadedFiles) {
  if (!Array.isArray(order)) return 'finalOrder must be an array';
  if (!order.every(Number.isInteger)) return 'finalOrder must contain integers';
  if (order.some(v => v < -1)) return 'Invalid finalOrder value';

  const existingIndexes = order.filter(v => v >= 0);
  if (new Set(existingIndexes).size !== existingIndexes.length) return 'Duplicate image indexes are not allowed';

  if (existingIndexes.some(idx => idx >= oldImages.length)) return 'Invalid existing image index';

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

// --- Middleware ---
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File upload ---
const ALLOWED_MIMES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIMES.get(file.mimetype);
    if (!ext) return cb(new Error('Unsupported image type'));
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Only JPEG, PNG and WebP are allowed'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }
});

// --- Auth middleware ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.user?.role === 'admin') return next();
  res.status(401).json({ error: 'Unauthorized' });
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
    res.clearCookie('connect.sid');
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

app.post('/api/categories', requireAdmin, (req, res) => {
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

app.delete('/api/categories', requireAdmin, (req, res) => {
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

app.post('/api/items', requireAdmin, upload.array('images', 10), (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE) || {};
  const settings = readJSON(SETTINGS_FILE) || {};
  const files = req.files || [];
  const images = files.map(f => '/uploads/' + f.filename);

  // Validation
  const errors = validateItemInput(req.body, cats);
  if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

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
});

app.put('/api/items/:id', requireAdmin, upload.array('images', 10), (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  const cats = readJSON(CATEGORIES_FILE) || {};
  const files = req.files || [];
  const idx = items.findIndex(i => i.id == req.params.id);
  if (idx === -1) { cleanupUploadedFiles(files); return res.status(404).json({ error: 'Not found' }); }

  // Build candidate — validate final state, not just partial fields
  const candidate = {
    ...items[idx],
    ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
    ...(req.body.section !== undefined && { section: String(req.body.section).trim() }),
    ...(req.body.category !== undefined && { category: String(req.body.category).trim() }),
    ...(req.body.price !== undefined && { price: String(req.body.price).trim() })
  };
  const errors = validateItemInput(candidate, cats);
  if (errors) { cleanupUploadedFiles(files); return res.status(400).json({ error: 'Validation failed', details: errors }); }

  if (req.body.title !== undefined) items[idx].title = candidate.title;
  if (req.body.author !== undefined) items[idx].author = req.body.author;
  if (req.body.price !== undefined) items[idx].price = candidate.price;
  if (req.body.recaster !== undefined) items[idx].recaster = req.body.recaster;
  if (req.body.combatPoints !== undefined) items[idx].combatPoints = req.body.combatPoints;
  if (req.body.status !== undefined) items[idx].status = req.body.status;
  if (req.body.section !== undefined) items[idx].section = candidate.section;
  if (req.body.category !== undefined) items[idx].category = candidate.category;

  if (!Array.isArray(items[idx].images)) items[idx].images = [];
  const oldImages = [...items[idx].images];

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
    const validationError = validateFinalOrder(finalOrder, oldImages, files);
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
      } else if (entry === -1 && fileIdx < files.length) {
        newImages.push('/uploads/' + files[fileIdx++].filename);
      }
    }
    items[idx].images = newImages;
  } else if (removeIdx.length > 0) {
    removeIdx.sort((a, b) => b - a).forEach(i => {
      if (i >= 0 && i < oldImages.length) oldImages.splice(i, 1);
    });
    items[idx].images = oldImages;
    files.forEach(f => items[idx].images.push('/uploads/' + f.filename));
  } else if (files.length > 0) {
    items[idx].images = [...oldImages, ...files.map(f => '/uploads/' + f.filename)];
  }

  if (items[idx].images.length > 10) {
    cleanupUploadedFiles(files);
    return res.status(400).json({ error: 'Maximum 10 images per item' });
  }

  if (files.length > 0 || removeIdx.length > 0 || finalOrder.length > 0) {
    if (items[idx].images && items[idx].images.length > 0) {
      items[idx].image = items[idx].images[0];
    } else {
      items[idx].images = [];
      items[idx].image = readJSON(SETTINGS_FILE)?.defaultImage || '/images/default.svg';
    }
  }

  try {
    writeJSONAtomic(ITEMS_FILE, items);
  } catch (err) {
    cleanupUploadedFiles(files);
    console.error('Failed to save items.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }

  // After successful save, delete old images no longer referenced
  const newSet = new Set(items[idx].images);
  for (const img of oldImages) {
    if (!newSet.has(img)) {
      const stillReferenced = items.some((other, oi) => oi !== idx && (other.image === img || other.images?.includes(img)));
      if (!stillReferenced) safeUnlink(img);
    }
  }

  res.json(items[idx]);
});

app.delete('/api/items/:id', requireAdmin, (req, res) => {
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

app.put('/api/settings', requireAdmin, (req, res) => {
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

app.post('/api/upload/default', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const settings = readJSON(SETTINGS_FILE) || {};
  const oldDefault = settings.defaultImage;
  settings.defaultImage = '/uploads/' + req.file.filename;
  try {
    writeJSONAtomic(SETTINGS_FILE, settings);
  } catch (err) {
    cleanupUploadedFiles([req.file]);
    console.error('Failed to save settings.json:', err);
    return res.status(500).json({ error: 'Failed to save data' });
  }
  // Delete old default image if no items still reference it
  if (oldDefault && oldDefault !== settings.defaultImage) {
    const items = readJSON(ITEMS_FILE) || [];
    const stillReferenced = items.some(i => i.image === oldDefault || i.images?.includes(oldDefault));
    if (!stillReferenced) safeUnlink(oldDefault);
  }
  res.json(settings);
});

// Spreadsheet endpoint (admin only)
app.get('/api/spreadsheet', requireAdmin, (req, res) => {
  const items = readJSON(ITEMS_FILE) || [];
  res.json(items);
});

// 404 for unknown API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler
app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload error', details: error.message });
  }
  if (error.message === 'Unsupported image type' || error.message === 'Only JPEG, PNG and WebP are allowed') {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`skyf1re Collection running at http://localhost:${PORT}`);
});
